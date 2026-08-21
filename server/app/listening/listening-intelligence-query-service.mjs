export function createListeningIntelligenceQueryService({ repository, now, parseFilters, ErrorType }) {
  return {
    aggregate(id) {
      const result = repository.getAggregate(id);
      if (!result) throw new ErrorType("Listening aggregate not found.", 404, "AGGREGATE_NOT_FOUND");
      return result;
    },
    aggregates: (query) => repository.listAggregates(parseFilters(query)),
    topics: (query) => repository.listTopics(parseFilters(query)),
    trends: (query) => repository.listTrends(parseFilters(query)),
    anomalies: (query) => repository.listAnomalies(parseFilters(query)),
    summary(query) {
      const filters = parseFilters(query);
      return { calculatedAt: now().toISOString(), factual: true, advice: null, aggregates: repository.listAggregates(filters), trends: repository.listTrends(filters), anomalies: repository.listAnomalies(filters), topics: repository.listTopics(filters) };
    },
  };
}
