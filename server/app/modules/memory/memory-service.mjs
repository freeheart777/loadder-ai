export class MemoryService {
  constructor({ repository }) {
    this.repository = repository;
  }

  remember(memory) {
    return this.repository.save({
      ...memory,
      createdAt: new Date().toISOString(),
    });
  }

  recall(workspaceId, type) {
    return this.repository.find({ workspaceId, type });
  }
}
