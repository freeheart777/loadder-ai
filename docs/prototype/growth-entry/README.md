# Growth Entry V1 — visual prototype

Dev-only route: `/prototype/growth-entry` (`?state=new|returning`).
Excluded from production builds. No backend call, no schema, no API, no
persistence, no new dependency. The entry prototype is untouched.

Where the growth path lands before Home has anything to say.

## The design claim

A page with nothing on it yet is not an empty page. It is the first page of a
relationship. So this screen never reports a shortage. It says what Loadder has
not learned yet, offers the smallest way to fix that, and shows the same three
steps it will always follow.

Both states share one spine — same heading slot, same process strip, same tools
row — so a returning person recognises the page they started on instead of being
moved to a different screen once data exists.

## Two states

**A — new user, zero knowledge** (`?state=new`). Opens on «هنوز کسب‌وکارت را
کامل نمی‌شناسم.» Then three ways in, cheapest first, each stating its price and
its payback: show me your page (about a minute), answer four short questions
(about three minutes), let me look at what you have already built (asks nothing
of you). The process strip marks step one as where you are.

**B — returning user, with Home data** (`?state=returning`). What Loadder saw,
what it still does not know, and one suggestion with a decision attached and its
consequences spelled out. The process strip marks step three. The «what I do not
know yet» column keeps a live link back to teaching it more, so state A's
question never fully closes.

## Process, in shopkeeper words

| Step | Shown as | Note |
| --- | --- | --- |
| Observe | نگاه می‌کنم | می‌بینم چه چیزی هست و چه چیزی نیست. |
| Understand | می‌فهمم | می‌گویم کدامش مهم است و چرا. |
| Suggest | پیشنهاد می‌دهم | یک کار می‌گویم؛ انجام دادنش با توست. |

No technical term appears in any of the three.

## Principles held

A shortcut, not a gatekeeper: the direct tools row renders on **both** states, so
nothing here is a prerequisite for opening a tool. All six targets are existing
routes in `src/App.tsx` — `/dashboard/websites`, `/dashboard/crm`,
`/dashboard/content`, `/dashboard/ads`, `/dashboard/websites/commerce`,
`/dashboard/analytics`.

A standing line on both states says nothing is published and no money is spent
until the person says so.

## Capture-time guards

Asserted on all four screenshots: the anchor sentence is present on state A, all
three process steps render on both states, six tool links render on both states,
zero horizontal overflow, and no banned phrase appears — «داده‌ای نیست»,
«چیزی موجود نیست», «راه‌اندازی لازم», «اطلاعاتی وجود ندارد», «خالی است»,
"no data", "nothing available", "setup required" — nor any Mission Control,
Business Brain, evidence, governance or Decision Room vocabulary.

## Open question for review

The anchor sentence was given in the informal voice («کسب‌وکارت»), so this
prototype speaks informally throughout. Shipped Home copy is formal («شما»).
That divergence is a decision, not an accident, and it needs settling before any
of this becomes production copy.

## Screens

Desktop 1280×900 and mobile 390×844, both at 2× scale.

| | Desktop | Mobile |
| --- | --- | --- |
| New user | `01-new-user-desktop.png` | `01-new-user-mobile.png` |
| Returning user | `02-returning-user-desktop.png` | `02-returning-user-mobile.png` |
