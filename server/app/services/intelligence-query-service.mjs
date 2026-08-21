import { BusinessEventError } from "./business-event-service.mjs";
import { decodeCursor, CursorPaginationError } from "../query/cursor-pagination.mjs";

function filters(query, signals = false) {
  const limit = Number(query.limit || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BusinessEventError("limit must be between 1 and 100.");
  const result = { limit };
  for (const field of ["type", "subjectType", "subjectId"]) {
    if (query[field]) {
      if (typeof query[field] !== "string" || query[field].length > 200) throw new BusinessEventError(`${field} is invalid.`);
      result[field] = query[field];
    }
  }
  if (signals && query.lifecycleStatus) {
    if (!["active", "expired", "superseded"].includes(query.lifecycleStatus)) throw new BusinessEventError("Signal lifecycle status is invalid.");
    result.lifecycleStatus = query.lifecycleStatus;
  }
  return result;
}

export function createIntelligenceQueryService({ repository }) {
  function observationPage(query) {
    const parsed = filters(query);
    try { parsed.cursor = decodeCursor(query.cursor, "normalized_observations", ["calculatedAt", "id"]); }
    catch (error) {
      if (error instanceof CursorPaginationError) throw new BusinessEventError(error.message, 400, error.code);
      throw error;
    }
    return repository.listObservationPage(parsed);
  }
  return Object.freeze({
    listObservationPage: observationPage,
    listObservations: (query) => observationPage(query).items,
    listSignals: (query) => repository.listSignals(filters(query, true)),
  });
}
