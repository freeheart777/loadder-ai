// Explicit projections only: contact details and authentication material never leave SQL.
export function parseInventoryPagination(query) {
  if (Object.keys(query).some(key => !["page", "pageSize"].includes(key))) return null;
  const integer = (value, fallback) => value === undefined ? fallback
    : typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
  const page = integer(query.page, 1);
  const pageSize = integer(query.pageSize, 25);
  const offset = (page - 1) * pageSize;
  return Number.isSafeInteger(page) && Number.isSafeInteger(pageSize) && pageSize <= 100 && Number.isSafeInteger(offset)
    ? { page, pageSize, offset } : null;
}

export function createPlatformAdminInventory(db) {
  const users = db.prepare(`
    WITH page AS (SELECT id, name, status, created_at FROM users ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?),
    memberships AS (
      SELECT m.user_id, COUNT(*) AS workspaceCount,
        SUM(CASE WHEN m.status='active' AND w.status='active' THEN 1 ELSE 0 END) AS activeWorkspaceCount
      FROM page p JOIN workspace_memberships m ON m.user_id=p.id JOIN workspaces w ON w.id=m.workspace_id GROUP BY m.user_id
    ), activity AS (
      SELECT s.user_id, MAX(s.last_seen_at) AS lastActivity FROM page p JOIN sessions s ON s.user_id=p.id GROUP BY s.user_id
    )
    SELECT p.id, p.name, p.status, p.created_at AS createdAt,
      COALESCE(m.workspaceCount,0) AS workspaceCount, COALESCE(m.activeWorkspaceCount,0) AS activeWorkspaceCount,
      a.lastActivity FROM page p LEFT JOIN memberships m ON m.user_id=p.id LEFT JOIN activity a ON a.user_id=p.id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  const workspaces = db.prepare(`
    WITH page AS (SELECT id, name, slug, status, created_at FROM workspaces ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?),
    memberships AS (
      SELECT m.workspace_id, COUNT(*) AS memberCount,
        SUM(CASE WHEN m.status='active' AND u.status='active' THEN 1 ELSE 0 END) AS activeMemberCount,
        SUM(CASE WHEN m.role='owner' THEN 1 ELSE 0 END) AS ownerCount
      FROM page p JOIN workspace_memberships m ON m.workspace_id=p.id JOIN users u ON u.id=m.user_id GROUP BY m.workspace_id
    )
    SELECT p.id, p.name, p.slug, p.status, p.created_at AS createdAt,
      COALESCE(m.memberCount,0) AS memberCount, COALESCE(m.activeMemberCount,0) AS activeMemberCount,
      COALESCE(m.ownerCount,0) AS ownerCount FROM page p LEFT JOIN memberships m ON m.workspace_id=p.id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  const userTotal = db.prepare("SELECT COUNT(*) AS total FROM users");
  const workspaceTotal = db.prepare("SELECT COUNT(*) AS total FROM workspaces");
  // Count and page share a read snapshot. Two queries per page, never per row.
  const read = (statement, count, map) => db.transaction(({page,pageSize,offset}) => ({
    items:statement.all(pageSize,offset).map(map),
    pagination:(() => { const {total} = count.get(); return {page,pageSize,total,totalPages:Math.ceil(total/pageSize)}; })(),
  }));
  return {
    users:read(users,userTotal,row => ({...row,lastActivity:row.lastActivity
      ? {status:"evidenced",at:row.lastActivity,source:"sessions.last_seen_at"} : {status:"unknown",at:null}})),
    workspaces:read(workspaces,workspaceTotal,row => row),
  };
}
