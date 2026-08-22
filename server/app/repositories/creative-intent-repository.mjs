import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const map = (row) => row ? Object.freeze({ id: row.id, intentType: row.intent_type, title: row.title, description: row.description, goal: row.goal, audienceSummary: row.audience_summary, successorIntentId: row.successor_intent_id, requestHash: row.request_hash, createdAt: row.created_at, updatedAt: row.updated_at }) : null;
export function createCreativeIntentRepository(db) {
  const workspace = () => requireWorkspaceId();
  const findById = (id) => map(db.prepare("SELECT * FROM creative_intents WHERE id=? AND workspace_id=?").get(id, workspace()));
  const findByIdempotency = (userId, key) => map(db.prepare("SELECT * FROM creative_intents WHERE workspace_id=? AND created_by_user_id=? AND operation_kind='creative_intent.create' AND idempotency_key=?").get(workspace(), userId, key));
  function create(input) {
    const id = crypto.randomUUID();
    try {
      return db.transaction(() => {
        if (input.successorOfIntentId) {
          const predecessor = db.prepare("SELECT * FROM creative_intents WHERE id=? AND workspace_id=?").get(input.successorOfIntentId, workspace());
          if (!predecessor) return { missingPredecessor: true };
          if (predecessor.successor_intent_id) return { successorConflict: true };
        }
        db.prepare(`INSERT INTO creative_intents(id,workspace_id,created_by_user_id,intent_type,title,description,goal,audience_summary,successor_intent_id,operation_kind,idempotency_key,request_hash,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,NULL,'creative_intent.create',?,?,?,?)`).run(id,workspace(),input.userId,input.intentType,input.title,input.description,input.goal,input.audienceSummary,input.idempotencyKey,input.requestHash,input.now,input.now);
        if (input.successorOfIntentId) db.prepare("UPDATE creative_intents SET successor_intent_id=?,updated_at=? WHERE id=? AND workspace_id=? AND successor_intent_id IS NULL").run(id,input.now,input.successorOfIntentId,workspace());
        return { intent: findById(id), created: true };
      })();
    } catch (error) {
      const winner = findByIdempotency(input.userId,input.idempotencyKey);
      if (winner) return { intent: winner, created: false };
      throw error;
    }
  }
  function listPage({limit,cursor}) { const values=[workspace()]; let where="workspace_id=?"; if(cursor){where+=" AND (created_at<? OR(created_at=? AND id<?))";values.push(cursor.createdAt,cursor.createdAt,cursor.id);} values.push(limit+1); const rows=db.prepare(`SELECT * FROM creative_intents WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(map); return pageResult(rows,limit,"creative_intents",item=>({createdAt:item.createdAt,id:item.id})); }
  return Object.freeze({findById,findByIdempotency,create,listPage});
}
