import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function mapUsage(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contextVersionId: row.context_version_id,
    userId: row.user_id,
    consumer: row.consumer,
    operation: row.operation,
    executionRequestId: row.execution_request_id,
    createdAt: row.created_at,
  };
}

export function createBusinessContextUsageRepository(db) {
  return {
    record({ contextVersionId, userId, consumer, operation, executionRequestId, createdAt }) {
      const id = crypto.randomUUID();
      db.prepare(`INSERT INTO business_context_usage (
        id, workspace_id, context_version_id, user_id, consumer,
        operation, execution_request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        requireWorkspaceId(),
        contextVersionId,
        userId || null,
        consumer,
        operation,
        executionRequestId || null,
        createdAt
      );
      return mapUsage(db.prepare(`SELECT * FROM business_context_usage
        WHERE id = ? AND workspace_id = ?`).get(id, requireWorkspaceId()));
    },
  };
}
