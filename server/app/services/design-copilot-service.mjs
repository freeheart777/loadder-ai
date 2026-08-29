const ALLOWED = new Set(["title","subtitle","bg","fg","padding","radius","align","ctaText","ctaHref","imageUrl","columns"]);
const ALIGN = new Set(["right","center","left"]);
const safeText = (v, max = 500) => typeof v === "string" ? v.replace(/[<>]/g, "").slice(0, max) : undefined;
const safeColor = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined;
const safeHref = (v) => {
  if (typeof v !== "string") return undefined;
  const x = v.trim().slice(0, 500);
  if (!x || /^javascript:/i.test(x) || /^data:/i.test(x)) return undefined;
  return x;
};

export function createDesignCopilotService({ projectService, modelRouter }) {
  async function propose(projectId, body = {}) {
    const project = projectService.get(projectId);
    const prompt = String(body.prompt || "").trim().slice(0, 1200);
    if (!prompt) throw Object.assign(new Error("Design prompt is required."), { status: 400, code: "DESIGN_PROMPT_REQUIRED" });
    const studio = project.content?.visualStudio;
    const section = Array.isArray(studio?.sections) ? studio.sections.find((item) => item.id === body.sectionId) : null;
    if (!section) throw Object.assign(new Error("Selected section was not found."), { status: 404, code: "DESIGN_SECTION_NOT_FOUND" });
    const result = await modelRouter.propose({ prompt, section, locale: body.locale || "fa-IR" });
    return { provider: result.provider, model: result.model, proposal: sanitizeProposal(result.proposal, section), executed: false };
  }
  return Object.freeze({ propose });
}

export function sanitizeProposal(raw = {}, section = {}) {
  const changes = {};
  for (const [key, value] of Object.entries(raw?.changes || {})) {
    if (!ALLOWED.has(key)) continue;
    if (key === "bg" || key === "fg") { const x = safeColor(value); if (x) changes[key] = x; continue; }
    if (key === "padding") { const n = Number(value); if (Number.isFinite(n)) changes[key] = Math.max(16, Math.min(160, Math.round(n))); continue; }
    if (key === "radius") { const n = Number(value); if (Number.isFinite(n)) changes[key] = Math.max(0, Math.min(80, Math.round(n))); continue; }
    if (key === "columns") { const n = Number(value); if (Number.isFinite(n)) changes[key] = Math.max(1, Math.min(6, Math.round(n))); continue; }
    if (key === "align") { if (ALIGN.has(value)) changes[key] = value; continue; }
    if (key === "ctaHref" || key === "imageUrl") { const x = safeHref(value); if (x) changes[key] = x; continue; }
    const x = safeText(value, key === "title" ? 180 : 500); if (x !== undefined) changes[key] = x;
  }
  return { sectionId: section.id, changes, summary: safeText(raw?.summary, 300) || "پیشنهاد طراحی آماده است." };
}
