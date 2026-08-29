import test from "node:test";
import assert from "node:assert/strict";
import { createDesignCopilotService, sanitizeProposal } from "../app/services/design-copilot-service.mjs";

test("design copilot sanitizes model output to the visual-studio allowlist", () => {
  const out = sanitizeProposal({ changes: { title: "<b>New</b>", bg: "#112233", padding: 999, columns: 9, ctaHref: "javascript:alert(1)", html: "<script>x</script>" }, summary: "ok" }, { id: "hero" });
  assert.equal(out.sectionId, "hero");
  assert.equal(out.changes.title, "bNew/b");
  assert.equal(out.changes.bg, "#112233");
  assert.equal(out.changes.padding, 160);
  assert.equal(out.changes.columns, 6);
  assert.equal(out.changes.ctaHref, undefined);
  assert.equal(out.changes.html, undefined);
});

test("design copilot checks project ownership through project service before routing a model request", async () => {
  let gotProject = false;
  const service = createDesignCopilotService({
    projectService: { get(id) { gotProject = id === "p1"; return { id, content: { visualStudio: { sections: [{ id: "hero", title: "A" }] } } }; } },
    modelRouter: { async propose() { return { provider: "test", model: "stub", proposal: { changes: { title: "Better" }, summary: "safe" } }; } },
  });
  const result = await service.propose("p1", { sectionId: "hero", prompt: "make it better" });
  assert.equal(gotProject, true);
  assert.equal(result.executed, false);
  assert.equal(result.proposal.changes.title, "Better");
});
