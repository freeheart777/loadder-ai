const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));

function renderBlock(block) {
  if (block.type === "hero-summary") return `<section class="hero"><h1>${esc(block.title)}</h1><p>${esc(block.subtitle)}</p></section>`;
  if (block.type === "metric-grid") return `<section class="metrics">${(block.metrics||[]).map((m)=>`<article><strong>—</strong><span>${esc(m.label)}</span></article>`).join("")}</section>`;
  if (block.type === "data-table") return `<section class="panel"><h3>${esc(block.resource)}</h3><div class="empty">داده‌ها پس از اتصال Data Adapter اینجا نمایش داده می‌شوند.</div></section>`;
  if (block.type === "form") return `<section class="panel"><form>${(block.fields||[]).map((f)=>`<label>${esc(f.label)}<input disabled placeholder="${esc(f.component)}" /></label>`).join("")}</form></section>`;
  if (block.type === "activity-feed") return `<section class="panel"><h3>فعالیت‌های اخیر</h3><div class="empty">هنوز رویدادی ثبت نشده است.</div></section>`;
  if (block.type === "copilot-panel") return `<section class="copilot"><strong>Loadder Copilot</strong><span>Agent آماده اتصال به Business Context است.</span></section>`;
  return `<section class="panel"><small>${esc(block.type)}</small></section>`;
}

export function renderExecutablePreview({ definition, ui, viewId = "dashboard" }) {
  const view = ui.views.find((item) => item.id === viewId) || ui.views[0];
  const rtl = ui.direction === "rtl";
  const nav = ui.navigation.map((item)=>`<button data-view="${esc(item.id)}">${esc(item.label)}</button>`).join("");
  const body = (view?.blocks || []).map(renderBlock).join("");
  return `<!doctype html><html lang="${esc(definition.locale)}" dir="${rtl?"rtl":"ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(definition.name)}</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#f5f7fb;color:#111827}.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}aside{background:#111827;color:white;padding:22px}aside h2{font-size:18px}nav{display:grid;gap:7px}button{border:0;background:transparent;color:inherit;text-align:start;padding:10px;border-radius:8px}main{padding:28px;max-width:1200px}.hero,.panel,.copilot,article{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:20px;margin-bottom:16px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}.metrics article{display:grid;gap:8px;margin:0}.metrics strong{font-size:28px}form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}label{display:grid;gap:6px}input{padding:10px;border:1px solid #d1d5db;border-radius:8px}.empty{padding:24px;color:#6b7280}.copilot{display:flex;gap:12px;justify-content:space-between}@media(max-width:720px){.shell{grid-template-columns:1fr}aside{display:none}main{padding:16px}}</style></head><body><div class="shell"><aside><h2>${esc(definition.name)}</h2><nav>${nav}</nav></aside><main>${body}<footer><small>Loadder Contract Preview • ${esc(definition.ownership?.runtimeContract)}</small></footer></main></div></body></html>`;
}

export function createContractPreviewAdapter() {
  return {
    id: "loadder-contract-html-v1",
    async start({ projectId, version }) {
      return { adapter: "loadder-contract-html-v1", url: `/api/business-builder/projects/${projectId}/preview/document`, document: renderExecutablePreview({ definition: version.definition, ui: version.ui }) };
    },
    render({ version }) { return renderExecutablePreview({ definition: version.definition, ui: version.ui }); },
  };
}
