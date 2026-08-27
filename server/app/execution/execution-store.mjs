export function createMemoryExecutionStore() {
  const records = new Map();
  return Object.freeze({
    async get(executionId) { return records.get(executionId); },
    async save(record) { records.set(record.executionId, Object.freeze({ ...record })); return records.get(record.executionId); },
  });
}
