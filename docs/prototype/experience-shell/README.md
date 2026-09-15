# Experience Shell V1 — the approved Experience Map, as navigation

Dev-only route: `/prototype/experience-shell`
(`?screen=entry|tools|growth|home|detail|brain` deep-links a step).

Frontend only. No backend, no schema, no API, no business logic, no new
dependency. Excluded from production builds. Removable as one directory.

## The map

```
entry ── "هنوز چیزی درباره کسب‌وکار شما نمی‌دانم."
  ├── «می‌دانم چه چیزی لازم دارم»  → tools   direct capability, ungated
  ├── «یک مشکل در کسب‌وکارم دارم»  → home    the centre, four zones
  └── «نمی‌دانم»                    → growth  understand first, then home

home ── detail ── تصمیم‌های گذشته   the only route to the Decision Room
home ── brain                        a static entry point, nothing more
```

## Rules the shell holds structurally

**Home is the centre after first understanding**, carrying exactly four zones in
this order: به شما نیاز دارد, در جریان, چیزی که یاد گرفته‌ام, ابزارهای شما.

**Direct access is never gated.** The same twelve-tool grid is one of the three
first answers *and* zone four of Home. Reaching a tool requires no goal, no
plan, no diagnosis.

**No tool is the primary experience.** Tools render last on Home, below the
decision. The browser proof asserts the ordering geometrically rather than
trusting the markup.

**The Brain is a static entry point.** It lists what is known and what is not,
asks nothing, and leads nowhere that asks anything.

**The Decision Room is reachable from a detail view and from nowhere else.**
The link is labelled «تصمیم‌های گذشته دربارهٔ همین موضوع» — a plain description,
not a system name.

**No module sidebar.** The shell renders no `<nav>` and no `<aside>` on any
screen. One step back is the whole of the navigation. Expert access is a command
menu later, not a permanent rail.

## Browser proof

`e2e/prototype/experience-shell.spec.ts`, 11 tests, all passing against a dev
server. Run it with:

```
E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/prototype
```

It asserts the entry sentence and its three answers, each path's destination,
Home's four zones and their order, tools rendering below the decision, the
twelve ungated tool links inside Home, the Brain asking for nothing, the
Decision Room appearing on the detail screen and on no other, the absence of a
sidebar on all six screens, and zero horizontal overflow at 1280 and 390 wide.

## Screens

Desktop 1280×900 and mobile 390×844, both at 2× scale. The capture sandbox has
no route to Google Fonts, so these render in the fallback Persian face rather
than Vazirmatn; layout and spacing are unaffected, letterforms are not.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| First entry | `01-first-entry-desktop.png` | `01-first-entry-mobile.png` |
| «می‌دانم چه لازم دارم» | `02-path-tools-desktop.png` | `02-path-tools-mobile.png` |
| «نمی‌دانم» | `03-path-growth-desktop.png` | `03-path-growth-mobile.png` |
| Home, four zones | `04-home-desktop.png` | `04-home-mobile.png` |
| Detail, with past decisions | `05-detail-desktop.png` | `05-detail-mobile.png` |
| Brain, static | `06-brain-desktop.png` | `06-brain-mobile.png` |

## Relationship to the earlier prototypes

The shell is a fourth, independent directory. It imports nothing from
`src/prototype/entry/` or `src/prototype/growth/`, so any of them can be deleted
without breaking the others. Where they disagree, the shell follows the approved
map: it speaks formally («شما»), and its growth screen is a compact version of
the standalone Growth Entry prototype rather than the same component.
