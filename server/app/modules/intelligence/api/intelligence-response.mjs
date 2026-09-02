export function intelligenceResponse(data = {}) {
  return { success: true, data, generatedAt: new Date().toISOString() };
}
