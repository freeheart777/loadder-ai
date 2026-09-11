# Home V2 — production

Replaces the dashboard-first experience with the approved Loadder Home.

Frontend only. No schema, no migration, no new endpoint, no change to
governance or evidence semantics, no Brain, no diagnosis engine, no plan or
initiative entity. The only server-side files touched are two source-guard
tests whose invariants moved with the code they guard.

## Surfaces

| Route | What it is |
| --- | --- |
| `/start` | The entry. One question, three answers. |
| `/dashboard` | Home. Four zones. |
| `/dashboard/attention` | The full attention surface, unchanged, one click in. |

A fresh sign-up lands on `/start`; a deep link still resolves to its
destination.

## The four zones

**1 · به شما نیاز دارد** reads `GET /api/mission-control` and shows the first
item the contract emitted. Home does not re-rank and does not summarise the
rest. «چرا این را می‌گویم؟» opens the recorded reason in place; «بقیهٔ موارد»
opens the full surface.

When the contract returns nothing, the zone says Loadder has not learned the
business yet and offers three first moves, each opening a real tool. It never
reports a shortage.

**2 · در جریان** reads `GET /api/growth/copilot/runs` and lists only runs the
canonical record marks `PREPARED` — something was made and a person has not
answered. A succeeded run is finished, not in progress. Nothing in the record
says how far along anything is, so no progress bar is drawn.

**3 · چیزی که یاد گرفته‌ایم** reads `GET /api/intelligence/semantic/findings`
and states one recorded finding per row: what was measured, and the state the
record holds. `INSUFFICIENT_EVIDENCE` is shown, not hidden. Canonical findings
carry no confidence today, so the closing line says the reason is unknown.

**4 · ابزارهای شما** is twelve existing routes, ungated, and the same grid the
entry offers. It renders below the decision, so no tool is the primary
experience.

## Navigation

Home, Tools, Account. No module sidebar. Depth comes from the thing you are
looking at: «چرا؟» on the item, the details surface behind it. A command menu
can land later without changing any of this.

## Vocabulary

Every user-facing sentence is a fixed entry in `src/lib/homeCopy.ts` or the
shared Mission Control tables in `src/lib/missionControlCopy.ts`. Nothing is
generated at runtime: a canonical token maps to a fixed Persian phrase or it
does not render. A test asserts that no `SCREAMING_SNAKE` token reaches the
screen.

## Tests

`e2e/home/home.spec.ts`, 13 tests, all passing. Every response is stubbed at
the network boundary, so the suite proves the surface without a server. The app
must be served with its API on the page's own origin, or the browser discards
the stubbed credentialed responses:

```
VITE_API_BASE_URL=http://localhost:5173 npx vite --port 5173
E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/home
```

It covers the entry flow and each answer's destination, the four zones and
their order, zone one's single item and its depth links, the empty zone one,
zone two's filtering and absent progress bar, zone three's recorded states
including not knowing yet, tool reachability and position, a failing zone
leaving the rest usable, navigation with no sidebar, the jargon guard, and
390px phone width.

## Screens

Desktop 1280×900 and mobile 390×844, both at 2× scale. The capture sandbox has
no route to Google Fonts, so these render in the fallback Persian face rather
than Vazirmatn; layout is unaffected, letterforms are not.

| | Desktop | Mobile |
| --- | --- | --- |
| Entry | `01-entry-desktop.png` | `01-entry-mobile.png` |
| Entry, tools | `02-entry-tools-desktop.png` | `02-entry-tools-mobile.png` |
| Home | `03-home-desktop.png` | `03-home-mobile.png` |
| Home, nothing known yet | `04-home-unknown-desktop.png` | `04-home-unknown-mobile.png` |
| Attention details | `05-attention-details-desktop.png` | `05-attention-details-mobile.png` |
