const ALLOWED_DENSITY = new Set(["compact", "comfortable", "spacious"]);
const ALLOWED_RADIUS = new Set(["small", "medium", "large"]);
const ALLOWED_SHELL = new Set(["loadder-business", "minimal", "dashboard"]);

export function applyLoadderEditorPatch(ui, patch = {}) {
  const next = structuredClone(ui);

  if (patch.theme) {
    const density = patch.theme.density;
    const radius = patch.theme.radius;
    const shell = patch.theme.shell;
    if (density !== undefined && !ALLOWED_DENSITY.has(density)) throw new Error("Unsupported density");
    if (radius !== undefined && !ALLOWED_RADIUS.has(radius)) throw new Error("Unsupported radius");
    if (shell !== undefined && !ALLOWED_SHELL.has(shell)) throw new Error("Unsupported shell");
    next.theme = {
      ...next.theme,
      ...(density ? { density } : {}),
      ...(radius ? { radius } : {}),
      ...(shell ? { shell } : {}),
    };
  }

  if (Array.isArray(patch.navigation)) {
    const labels = new Map(
      patch.navigation
        .filter((item) => item && typeof item.id === "string" && typeof item.label === "string")
        .map((item) => [item.id, item.label.trim().slice(0, 80)]),
    );
    next.navigation = next.navigation.map((item) => labels.has(item.id) ? { ...item, label: labels.get(item.id) } : item);
  }

  if (Array.isArray(patch.views)) {
    const titles = new Map(
      patch.views
        .filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
        .map((item) => [item.id, item.title.trim().slice(0, 100)]),
    );
    next.views = next.views.map((view) => titles.has(view.id) ? { ...view, title: titles.get(view.id) } : view);
  }

  if (Array.isArray(patch.fields)) {
    const visibility = new Map(
      patch.fields
        .filter((item) => item && typeof item.entityId === "string" && typeof item.fieldId === "string" && typeof item.visible === "boolean")
        .map((item) => [`${item.entityId}:${item.fieldId}`, item.visible]),
    );

    next.views = next.views.map((view) => {
      if (!view.resource) return view;
      const blocks = (view.blocks || []).map((block) => {
        if (block.type === "data-table" && Array.isArray(block.columns)) {
          return { ...block, columns: block.columns.filter((column) => visibility.get(`${view.resource}:${column.id}`) !== false) };
        }
        if (block.type === "form" && Array.isArray(block.fields)) {
          return { ...block, fields: block.fields.filter((field) => visibility.get(`${view.resource}:${field.id}`) !== false) };
        }
        if (block.type === "record-summary" && Array.isArray(block.fields)) {
          return { ...block, fields: block.fields.filter((fieldId) => visibility.get(`${view.resource}:${fieldId}`) !== false) };
        }
        return block;
      });
      return { ...view, blocks };
    });
  }

  return Object.freeze(next);
}

export const LOADDER_EDITOR_CAPABILITIES = Object.freeze({
  theme: ["density", "radius", "shell"],
  navigation: ["rename"],
  views: ["rename"],
  fields: ["hide"],
  future: ["block-reorder", "block-visibility", "page-layout", "component-props"],
});
