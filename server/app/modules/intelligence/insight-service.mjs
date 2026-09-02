export class InsightService {
  constructor({ repository }) {
    this.repository = repository;
  }

  create(input) {
    return this.repository.save({
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  listByEntity(entityType, entityId) {
    return this.repository.findByEntity(entityType, entityId);
  }
}
