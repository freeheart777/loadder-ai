const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));

function renderBlock(block) {
  if (block.type === "hero-summary") return `<section class="hero"><h1>${esc(block.title)}</h1><p>${esc(block.subtitle)}</p></section>`;
  if (block.type === "metric-grid") return `<section class="metrics">${(block.metrics||[]).map((m)=>`<article><strong>—</strong><span>${esc(m.label)}</span></article>`).join("")}</section>`;
  if (block.type === "data-table") return `<section class="panel"><h3>${esc(block.resource)}</h3><div class="empty">داده‌های Sandbox در Live Preview اینجا نمایش داده می‌شوند.</div></section>`;
  if (block.type === "form") return `<section class="panel"><form>${(block.fields||[]).map((f)=>`<label>${esc(f.label)}<input disabled placeholder="${esc(f.component)}" /></label>`).join("")}</form><small class="hint">فرم در Design Preview غیرفعال است؛ برای تست داده از Live Sandbox استفاده می‌شود.</small></section>`;
  if (block.type === "activity-feed") return `<section class="panel"><h3>فعالیت‌های اخیر</h3><div class="empty">هنوز رویداد Sandbox ثبت نشده است.</div></section>`;
  if (block.type === "copilot-panel") return `<section class="copilot"><strong>Loadder Copilot</strong><span>در Preview هیچ اقدام خارجی بدون تأیید اجرا نمی‌شود.</span></section>`;
  return `<section class="panel"><small>${esc(block.type)}</small></section>`;
}

export function renderExecutablePreview({ definition, ui, viewId = "dashboard" }) {
  const rtl = ui.direction === "rtl";
  const nav = ui.navigation.map((item)=>`<a href="#view-${esc(item.id)}">${esc(item.label)}</a>`).join("");
  const orderedViews=[...ui.views].sort((a,b)=>a.id===viewId?-1:b.id===viewId?1:0);
  const views=orderedViews.map((view)=>`<section class="preview-view" id="view-${esc(view.id)}"><header class="view-title"><span>Preview View</span><h2>${esc(view.title||view.name||view.id)}</h2></header>${(view.blocks||[]).map(renderBlock).join("")}</section>`).join("");
  return `<!doctype html><html lang="${esc(definition.locale)}" dir="${rtl?"rtl":"ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(definition.name)}</title><style>html{scroll-behavior:smooth}body{margin:0;font-family:system-ui,sans-serif;background:#f5f7fb;color:#111827}.shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}aside{position:sticky;top:0;height:100vh;box-sizing:border-box;overflow:auto;background:#111827;color:white;padding:22px}aside h2{font-size:18px}nav{display:grid;gap:7px}nav a{color:inherit;text-decoration:none;padding:10px;border-radius:8px}nav a:hover,nav a:focus{background:#ffffff14;outline:none}main{padding:28px;max-width:1200px;width:100%;box-sizing:border-box}.preview-view{scroll-margin-top:20px;border-bottom:1px solid #dbe1ea;padding-bottom:32px;margin-bottom:32px}.view-title span{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}.view-title h2{font-size:22px;margin:5px 0 16px}.hero,.panel,.copilot,article{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:20px;margin-bottom:16px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}.metrics article{display:grid;gap:8px;margin:0}.metrics strong{font-size:28px}form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}label{display:grid;gap:6px}input{padding:10px;border:1px solid #d1d5db;border-radius:8px}.empty{padding:24px;color:#6b7280}.hint{display:block;margin-top:12px;color:#94a3b8}.copilot{display:flex;gap:12px;justify-content:space-between}footer{color:#94a3b8}@media(max-width:720px){.shell{grid-template-columns:1fr}aside{position:static;height:auto;padding:14px}aside h2{margin:0 0 10px}nav{display:flex;overflow:auto}nav a{white-space:nowrap}main{padding:16px}.preview-view{scroll-margin-top:8px}}</style></head><body><div class="shell"><aside><h2>${esc(definition.name)}</h2><nav>${nav}</nav></aside><main>${views}<footer><small>Loadder Design Preview • منتشر نشده • ${esc(definition.ownership?.runtimeContract)}</small></footer></main></div></body></html>`;
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
