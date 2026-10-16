# Visual Studio V17: direct editing on top of V16

No schema change, no new editor framework, no new dependency. V17 is the V16 Studio with direct editing added.

| Area | What it does | Where |
|---|---|---|
| Editable fields | Closed list of existing document fields editable on the canvas; read/write match the Inspector's update semantics; active-page and capability boundaries; plain text only (Persian, ZWNJ preserved) | `src/components/store-studio-v16/editable-fields.ts` |
| Inline text | Double click or Enter edits in place; Escape cancels; Enter/blur commits; IME-safe; plain paste; touch: tap again on a selected element | `EditableText.tsx` (all editing DOM access lives here) |
| Images | Replace action always visible on empty slots and the selected element, keyboard operable; same media pipeline | `StudioCanvas.tsx` (`InlineMediaControl`) |
| Selection | One selection state; section toolbar (move, duplicate, hide, delete); empty-page state | `StudioCanvas.tsx`, `InspectorPanel.tsx`, `pages.ts` (`scopeSelection`) |
| Workspace | Pages / Sections / Design in Persian | `InspectorPanel.tsx`, `PageManager.tsx` |
| Top bar | Primary actions visible; secondary actions in the more menu | `StudioMoreMenu.tsx`, `StudioToolbar.tsx` |
| Small screens | Settings sheet opens on request (it would cover the canvas); 44px touch targets; focus rings | Studio page, `StudioCanvas.tsx` |

Not supported (by design or schema): alt text (no field), rich text, autosave, editing transactional data (prices, stock, checkout, booking ids, links) as generic text.
Manual browser checks not automated here: Safari and Firefox (contentEditable and IME behave slightly differently), real touch devices, screen readers (VoiceOver/NVDA).

Browser suites: `e2e/unit/editable-fields.spec.ts` (no browser) and `e2e/websites/website-inline-editing*.spec.ts`, `website-inline-images`, `website-studio-selection`, `website-studio-navigation`, `website-studio-toolbar`, `website-studio-mobile-a11y`, `website-v17-journey`. Docker: `docker/prod-e2e.sh inline|images|selection|navigation|toolbar|a11y`.
