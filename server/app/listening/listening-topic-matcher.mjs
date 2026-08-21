import { normalizeTopicText } from "./listening-intelligence-contracts.mjs";

export function collectEntitySets(records, context) {
  const sets = { brand: new Set(), competitor: new Set() };
  for (const record of records) {
    for (const value of record.brands) sets.brand.add(value);
    for (const value of record.competitors) sets.competitor.add(value);
  }
  if (context.state === "READY" && context.context?.identity?.businessName) {
    sets.brand.add(context.context.identity.businessName);
  }
  return sets;
}

export function recordMentionsEntity(record, entitySet) {
  const haystack = normalizeTopicText(`${record.title || ""} ${record.normalized_text || ""}`);
  return [...entitySet].some((value) => haystack.includes(normalizeTopicText(value)));
}

export function matchListeningTopics({ records, repository, calculatedAt, hash }) {
  const matches = [];
  for (const record of records) {
    const haystack = normalizeTopicText(`${record.title || ""} ${record.normalized_text || ""}`);
    const configuredSets = [
      ["brand", record.brands],
      ["competitor", record.competitors],
      ["product", record.products],
      ["keyword", record.keywords],
      ["custom_phrase", record.phrases],
    ];
    for (const [type, values] of configuredSets) {
      for (const configured of values) {
        const normalized = normalizeTopicText(configured);
        if (!normalized || !haystack.includes(normalized)) continue;
        matches.push(repository.createTopic({
          recordId: record.id,
          monitorVersionId: record.monitor_version_id,
          type,
          key: normalized,
          configured,
          matched: configured,
          normalized,
          language: record.language,
          method: type === "keyword" ? "normalized_token_or_substring" : "normalized_exact_phrase",
          producerKey: hash([record.id, type, normalized, 1]),
          at: calculatedAt,
        }));
      }
    }
  }
  return matches;
}
