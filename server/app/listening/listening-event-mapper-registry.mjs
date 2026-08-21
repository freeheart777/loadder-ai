const definitions = [
  { mappingId:"listening_review_event",mappingVersion:1,canonicalType:"review",eventType:"review.published",subjectType:"review" },
  { mappingId:"listening_engagement_event",mappingVersion:1,canonicalType:"engagement_metric",eventType:"social.engagement_observed",subjectType:"listening_record" },
  { mappingId:"listening_news_event",mappingVersion:1,canonicalType:"news_article",eventType:"news.reference_observed",subjectType:"listening_record" },
  { mappingId:"listening_mention_event",mappingVersion:1,canonicalType:"*",eventType:"brand.mentioned",subjectType:"listening_record" },
];
export const listeningEventMapperRegistry=Object.freeze({list:()=>definitions.map(x=>({...x})),forRecord(record,monitor){if(record.canonicalType==="review")return definitions[0];if(record.canonicalType==="engagement_metric")return definitions[1];if(record.canonicalType==="news_article")return definitions[2];const base={...definitions[3]};if(monitor.monitorType==="COMPETITOR")base.eventType="competitor.mentioned";if(monitor.monitorType==="PRODUCT")base.eventType="product.mentioned";return base;}});
