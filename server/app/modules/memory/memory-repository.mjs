export class MemoryRepository {
  constructor({ db }) {
    this.db = db;
  }

  save(memory) {
    const id = `mem_${crypto.randomUUID()}`;
    this.db.prepare(`
      INSERT INTO business_memory
      (id, workspace_id, memory_type, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      memory.workspaceId,
      memory.type,
      JSON.stringify(memory.content || {}),
      new Date().toISOString()
    );

    return { id, ...memory };
  }

  find({ workspaceId, type }) {
    return this.db.prepare(`
      SELECT * FROM business_memory
      WHERE workspace_id=? AND memory_type=?
      ORDER BY created_at DESC
    `).all(workspaceId, type);
  }
}
