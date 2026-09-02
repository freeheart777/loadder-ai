export class InsightRepository {
  constructor({ db }) {
    this.db = db;
  }

  save({ workspaceId, entityId, type, content }) {
    return {
      workspaceId,
      entityId,
      type,
      content,
      createdAt: new Date().toISOString(),
    };
  }
}
