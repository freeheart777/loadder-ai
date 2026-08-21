import crypto from "crypto";

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    mobile: row.mobile,
    name: row.name,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMembership(row) {
  return {
    id: row.membership_id,
    role: row.role,
    status: row.membership_status,
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      slug: row.workspace_slug,
      status: row.workspace_status,
      createdAt: row.workspace_created_at,
      updatedAt: row.workspace_updated_at,
    },
    createdAt: row.membership_created_at,
    updatedAt: row.membership_updated_at,
  };
}

export function createIdentityRepository(db) {
  const findUserByIdStatement = db.prepare(
    "SELECT * FROM users WHERE id = ?"
  );
  const findUserByMobileStatement = db.prepare(
    "SELECT * FROM users WHERE mobile = ?"
  );

  function findUserById(id) {
    return mapUser(findUserByIdStatement.get(id));
  }

  function findUserByMobile(mobile) {
    return mapUser(findUserByMobileStatement.get(mobile));
  }

  function listMemberships(userId) {
    return db
      .prepare(`
        SELECT
          wm.id AS membership_id,
          wm.role,
          wm.status AS membership_status,
          wm.created_at AS membership_created_at,
          wm.updated_at AS membership_updated_at,
          w.id AS workspace_id,
          w.name AS workspace_name,
          w.slug AS workspace_slug,
          w.status AS workspace_status,
          w.created_at AS workspace_created_at,
          w.updated_at AS workspace_updated_at
        FROM workspace_memberships wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
          AND wm.status = 'active'
          AND w.status = 'active'
        ORDER BY wm.created_at ASC
      `)
      .all(userId)
      .map(mapMembership);
  }

  function findMembership(userId, workspaceId) {
    return (
      listMemberships(userId).find(
        (membership) => membership.workspace.id === workspaceId
      ) || null
    );
  }

  function createOtpChallenge({
    mobile,
    name,
    codeHash,
    expiresAt,
    createdAt,
  }) {
    const id = crypto.randomUUID();

    db.prepare(`
      UPDATE otp_challenges
      SET consumed_at = ?
      WHERE mobile = ? AND consumed_at IS NULL
    `).run(createdAt, mobile);

    db.prepare(`
      INSERT INTO otp_challenges (
        id, mobile, name, code_hash, expires_at,
        attempts, consumed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
    `).run(id, mobile, name, codeHash, expiresAt, createdAt);

    return { id, mobile, name, expiresAt, attempts: 0, createdAt };
  }

  function findActiveOtpChallenge(mobile) {
    return db.prepare(`
      SELECT * FROM otp_challenges
      WHERE mobile = ? AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(mobile) || null;
  }

  function incrementOtpAttempts(id) {
    db.prepare(`
      UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?
    `).run(id);
  }

  function consumeOtpChallenge(id, consumedAt) {
    db.prepare(`
      UPDATE otp_challenges SET consumed_at = ? WHERE id = ?
    `).run(consumedAt, id);
  }

  function createUserWorkspaceAndMembership({
    mobile,
    name,
    workspaceName,
    workspaceSlug,
    timestamp,
  }) {
    return db.transaction(() => {
      let user = findUserByMobile(mobile);

      if (!user) {
        const userId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO users (
            id, mobile, name, email, status, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, 'active', ?, ?)
        `).run(userId, mobile, name, timestamp, timestamp);
        user = findUserById(userId);
      }

      let memberships = listMemberships(user.id);

      if (memberships.length === 0) {
        const workspaceId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO workspaces (
            id, name, slug, status, created_at, updated_at
          ) VALUES (?, ?, ?, 'active', ?, ?)
        `).run(
          workspaceId,
          workspaceName,
          workspaceSlug,
          timestamp,
          timestamp
        );
        db.prepare(`
          INSERT INTO workspace_memberships (
            id, workspace_id, user_id, role, status, created_at, updated_at
          ) VALUES (?, ?, ?, 'owner', 'active', ?, ?)
        `).run(
          crypto.randomUUID(),
          workspaceId,
          user.id,
          timestamp,
          timestamp
        );
        memberships = listMemberships(user.id);
      }

      return { user, memberships };
    })();
  }

  function createSession({
    userId,
    tokenHash,
    activeWorkspaceId,
    expiresAt,
    timestamp,
  }) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sessions (
        id, user_id, token_hash, expires_at,
        created_at, last_seen_at, revoked_at, active_workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(
      id,
      userId,
      tokenHash,
      expiresAt,
      timestamp,
      timestamp,
      activeWorkspaceId || null
    );
    return {
      id,
      userId,
      activeWorkspaceId: activeWorkspaceId || null,
      expiresAt,
      createdAt: timestamp,
    };
  }

  function findSessionByTokenHash(tokenHash) {
    return db.prepare(`
      SELECT * FROM sessions WHERE token_hash = ?
    `).get(tokenHash) || null;
  }

  function touchSession(id, timestamp) {
    db.prepare(`
      UPDATE sessions SET last_seen_at = ? WHERE id = ?
    `).run(timestamp, id);
  }

  function revokeSession(id, timestamp) {
    db.prepare(`
      UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL
    `).run(timestamp, id);
  }

  function setSessionActiveWorkspace(id, workspaceId, timestamp) {
    db.prepare(`
      UPDATE sessions
      SET active_workspace_id = ?, last_seen_at = ?
      WHERE id = ? AND revoked_at IS NULL
    `).run(workspaceId, timestamp, id);
  }

  function createAuditLog({
    workspaceId = null,
    userId = null,
    action,
    resourceType,
    resourceId = null,
    metadata = {},
    createdAt,
  }) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO audit_logs (
        id, workspace_id, user_id, action, resource_type,
        resource_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workspaceId,
      userId,
      action,
      resourceType,
      resourceId,
      JSON.stringify(metadata || {}),
      createdAt
    );
    return id;
  }

  return {
    db,
    findUserById,
    findUserByMobile,
    listMemberships,
    findMembership,
    createOtpChallenge,
    findActiveOtpChallenge,
    incrementOtpAttempts,
    consumeOtpChallenge,
    createUserWorkspaceAndMembership,
    createSession,
    findSessionByTokenHash,
    touchSession,
    revokeSession,
    setSessionActiveWorkspace,
    createAuditLog,
  };
}
