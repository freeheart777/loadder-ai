import assert from "node:assert/strict";
import test from "node:test";
import { renderCorporateSite } from "../app/services/corporate-site-html.mjs";

const project = { id: "edu-perf", siteType: "EDUCATION", name: "آموزشگاه" };
const render = (items, detailSlug) => {
  const pages = [
    { id: "home", title: "خانه", slug: "", sections: [] },
    { id: "performances", title: "اجراها", slug: "performances", sections: [{ id: "perf", type: "portfolio", enabled: true, title: "اجراها", items }] },
  ];
  const content = { storeBuilderV16: { header: { storeName: "آموزشگاه" }, pages, sections: pages[0].sections } };
  return renderCorporateSite(project, { version: 1, content }, content, { slug: "performances", detailSlug, basePath: "/sites/edu-perf" });
};

test("performance list links to a detail page and plays only an https video with poster", () => {
  const items = [{ id: "a", title: "اجرای بهار", subtitle: "کنسرت", body: "شرح", imageUrl: "https://cdn.example/p.jpg", videoUrl: "https://cdn.example/v.mp4" }];
  assert.ok(render(items).includes(`/sites/edu-perf/performances/${encodeURIComponent("اجرای-بهار")}`));
  const detail = render(items, "اجرای-بهار");
  assert.match(detail, /<video controls playsinline preload="metadata" data-performance-video="true" poster="https:\/\/cdn\.example\/p\.jpg" src="https:\/\/cdn\.example\/v\.mp4">/);
  assert.doesNotMatch(detail, /data-video-state="unavailable"/);
});

test("performance detail says unavailable instead of faking a player", () => {
  for (const videoUrl of [undefined, "", "javascript:alert(1)", "http://insecure.example/v.mp4", "data:video/mp4;base64,AAAA"]) {
    const detail = render([{ id: "a", title: "اجرا", videoUrl }], "اجرا");
    assert.doesNotMatch(detail, /<video/);
    assert.match(detail, /data-video-state="unavailable"/);
  }
});

test("other Education detail pages never render a video block", () => {
  const pages = [{ id: "home", title: "خانه", slug: "", sections: [] }, { id: "courses", title: "دوره‌ها", slug: "courses", sections: [{ id: "c", type: "services", enabled: true, title: "دوره", items: [{ id: "a", title: "پیانو", videoUrl: "https://cdn.example/v.mp4" }] }] }];
  const content = { storeBuilderV16: { header: { storeName: "x" }, pages, sections: [] } };
  assert.doesNotMatch(renderCorporateSite(project, { version: 1, content }, content, { slug: "courses", detailSlug: "پیانو" }), /<video|video-state/);
});
