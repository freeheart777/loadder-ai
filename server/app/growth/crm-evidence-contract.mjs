export const CRM_GROWTH_SOURCE = 'loadder.crm.lead-conversion.v1';
export const CRM_GROWTH_EVENT_KEY = 'converted';

export function isCrmGrowthSource(source) {
  return typeof source === 'string' && source.startsWith('loadder.crm.');
}
