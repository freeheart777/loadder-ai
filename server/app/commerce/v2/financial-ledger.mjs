export class FinancialLedgerError extends Error {
  constructor(message, code = "FINANCIAL_LEDGER_ERROR", status = 400) {
    super(message);
    this.name = "FinancialLedgerError";
    this.code = code;
    this.status = status;
  }
}

const required = (value, name) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new FinancialLedgerError(`${name} is required`, "FINANCIAL_INPUT_REQUIRED", 400);
  }
  return normalized;
};

const safeLimit = (value, fallback = 100) =>
  Math.max(1, Math.min(Number(value) || fallback, 500));

const mapEntry = (row) => {
  if (!row) return null;
  let metadata = {};
  try {
    metadata = JSON.parse(row.metadataJson || "{}");
  } catch {
    metadata = {};
  }
  const { metadataJson, ...entry } = row;
  return { ...entry, metadata };
};

export function listLedgerEntries(
  db,
  { workspaceId, siteProjectId = null, orderId = null, entryType = null, limit = 100 } = {}
) {
  const workspace = required(workspaceId, "workspaceId");
  const where = ["workspace_id=?"];
  const args = [workspace];

  if (siteProjectId) {
    where.push("site_project_id=?");
    args.push(required(siteProjectId, "siteProjectId"));
  }
  if (orderId) {
    where.push("order_id=?");
    args.push(required(orderId, "orderId"));
  }
  if (entryType) {
    where.push("entry_type=?");
    args.push(required(entryType, "entryType").toUpperCase());
  }

  return db
    .prepare(`
      SELECT
        id,
        workspace_id AS workspaceId,
        site_project_id AS siteProjectId,
        order_id AS orderId,
        source_type AS sourceType,
        source_id AS sourceId,
        entry_type AS entryType,
        amount_minor AS amountMinor,
        currency,
        occurred_at AS occurredAt,
        metadata_json AS metadataJson,
        created_at AS createdAt
      FROM ecommerce_financial_ledger
      WHERE ${where.join(" AND ")}
      ORDER BY occurred_at DESC, id DESC
      LIMIT ?
    `)
    .all(...args, safeLimit(limit))
    .map(mapEntry);
}

export function getOrderFinancialSummary(db, { workspaceId, orderId } = {}) {
  const workspace = required(workspaceId, "workspaceId");
  const order = required(orderId, "orderId");
  const source = db
    .prepare(`
      SELECT
        id,
        workspace_id AS workspaceId,
        site_project_id AS siteProjectId,
        currency,
        total_minor AS orderTotalMinor,
        payment_status AS paymentStatus,
        payment_provider AS paymentProvider,
        payment_reference AS paymentReference,
        created_at AS orderCreatedAt,
        updated_at AS orderUpdatedAt
      FROM ecommerce_orders
      WHERE workspace_id=? AND id=?
    `)
    .get(workspace, order);

  if (!source) return null;

  const sums = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type='PAYMENT_CAPTURED' THEN amount_minor ELSE 0 END),0) AS paidMinor,
        COALESCE(SUM(CASE WHEN entry_type='REFUND' THEN ABS(amount_minor) ELSE 0 END),0) AS refundedMinor
      FROM ecommerce_financial_ledger
      WHERE workspace_id=? AND order_id=?
    `)
    .get(workspace, order);

  return {
    ...source,
    paidMinor: sums.paidMinor,
    refundedMinor: sums.refundedMinor,
    netMinor: sums.paidMinor - sums.refundedMinor,
  };
}

export function getOrderFinancialTimeline(
  db,
  { workspaceId, orderId, limit = 100 } = {}
) {
  const summary = getOrderFinancialSummary(db, { workspaceId, orderId });
  if (!summary) return null;
  return {
    summary,
    entries: listLedgerEntries(db, { workspaceId, orderId, limit }),
  };
}

export function reconcileCapturedPayment(
  db,
  { workspaceId, orderId, now = new Date().toISOString() } = {}
) {
  const workspace = required(workspaceId, "workspaceId");
  const order = required(orderId, "orderId");
  const source = db
    .prepare(`
      SELECT
        id, workspace_id, site_project_id, currency, total_minor,
        payment_status, payment_reference, payment_provider,
        subtotal_minor, discount_minor, shipping_minor, updated_at
      FROM ecommerce_orders
      WHERE workspace_id=? AND id=?
    `)
    .get(workspace, order);

  if (!source) return { status: "missing_order" };
  if (source.payment_status !== "PAID") return { status: "not_paid" };

  const findCapture = () =>
    db
      .prepare(`
        SELECT id, amount_minor, currency
        FROM ecommerce_financial_ledger
        WHERE workspace_id=?
          AND source_type='ORDER_PAYMENT'
          AND source_id=?
          AND entry_type='PAYMENT_CAPTURED'
      `)
      .get(workspace, order);

  const consistency = (entry) => {
    if (!entry) return null;
    if (entry.amount_minor !== source.total_minor || entry.currency !== source.currency) {
      return {
        status: "conflict",
        entryId: entry.id,
        expected: { amountMinor: source.total_minor, currency: source.currency },
        actual: { amountMinor: entry.amount_minor, currency: entry.currency },
      };
    }
    return { status: "already_consistent", entryId: entry.id };
  };

  const existing = findCapture();
  if (existing) return consistency(existing);

  const entryId = `ledger:payment-captured:${order}`;
  db.prepare(`
    INSERT OR IGNORE INTO ecommerce_financial_ledger(
      id, workspace_id, site_project_id, order_id,
      source_type, source_id, entry_type,
      amount_minor, currency, occurred_at, metadata_json, created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    entryId,
    workspace,
    source.site_project_id,
    order,
    "ORDER_PAYMENT",
    order,
    "PAYMENT_CAPTURED",
    source.total_minor,
    source.currency,
    source.updated_at || now,
    JSON.stringify({
      paymentReference: source.payment_reference,
      paymentProvider: source.payment_provider,
      subtotalMinor: source.subtotal_minor,
      discountMinor: source.discount_minor,
      shippingMinor: source.shipping_minor,
      totalMinor: source.total_minor,
      paymentStatus: source.payment_status,
      reconciled: true,
    }),
    now
  );

  const inserted = findCapture();
  const resolved = consistency(inserted);
  if (resolved?.status === "conflict") return resolved;
  return { status: "repaired", entryId: inserted.id };
}

export function createFinancialLedgerService({
  db,
  auditRepository = null,
  clock = () => new Date().toISOString(),
} = {}) {
  if (!db) {
    throw new FinancialLedgerError(
      "Database is required for the financial ledger service.",
      "FINANCIAL_DATABASE_REQUIRED",
      500
    );
  }

  const reconcileTransaction = db.transaction(
    ({ workspaceId, orderId, userId, actorRole, createdAt }) => {
      const result = reconcileCapturedPayment(db, {
        workspaceId,
        orderId,
        now: createdAt,
      });

      auditRepository.createAuditLog({
        workspaceId,
        userId,
        action: "commerce.financial.reconcile",
        resourceType: "ecommerce_order",
        resourceId: orderId,
        metadata: {
          actorRole,
          result,
        },
        createdAt,
      });

      return result;
    }
  );

  return Object.freeze({
    list(input = {}) {
      return listLedgerEntries(db, input);
    },

    getOrderFinancials(input = {}) {
      return getOrderFinancialTimeline(db, input);
    },

    reconcile({ workspaceId, orderId, userId, actorRole } = {}) {
      const role = required(actorRole, "actorRole").toLowerCase();
      if (!new Set(["owner", "admin"]).has(role)) {
        throw new FinancialLedgerError(
          "Owner or admin access is required for financial reconciliation.",
          "FINANCIAL_ADMIN_REQUIRED",
          403
        );
      }
      const actor = required(userId, "userId");
      if (!auditRepository || typeof auditRepository.createAuditLog !== "function") {
        throw new FinancialLedgerError(
          "Financial reconciliation audit storage is unavailable.",
          "FINANCIAL_AUDIT_UNAVAILABLE",
          503
        );
      }

      return reconcileTransaction({
        workspaceId: required(workspaceId, "workspaceId"),
        orderId: required(orderId, "orderId"),
        userId: actor,
        actorRole: role,
        createdAt: clock(),
      });
    },
  });
}
