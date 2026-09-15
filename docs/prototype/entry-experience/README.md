# Entry Experience V1 — visual prototype

Dev-only route: `/prototype/entry-experience` (`?path=build|grow|tool` deep-links a step).
Excluded from production builds. No backend call, no schema, no persistence, no new dependency.

One question — «برای چه کاری آمده‌اید؟» — with three answers. Two of the three never
pass through Home, so someone who came for a website or an advertisement is never
asked for a goal, a plan or a diagnosis first.

## Route mapping

Every target below is an existing route declared in `src/App.tsx`.

### A — ساختن چیزی (`?path=build`)

| Choice | Route |
| --- | --- |
| یک سایت | `/dashboard/websites` |
| یک فروشگاه اینترنتی | `/dashboard/websites/setup` |
| یک اپلیکیشن برای کارتان | `/dashboard/business-builder` |
| هویت و برند | `/dashboard/brand-book` |
| یک پیشنهاد کاری | `/dashboard/business-proposal` |

### B — رشد دادن کسب‌وکار (`?path=grow`)

| Choice | Route |
| --- | --- |
| خانه را باز کنید | `/dashboard` |

### C — استفاده مستقیم از ابزار (`?path=tool`)

| Choice | Route |
| --- | --- |
| مشتری‌ها | `/dashboard/crm` |
| ساخت محتوا | `/dashboard/content` |
| سایت‌ساز | `/dashboard/websites` |
| فروشگاه | `/dashboard/websites/commerce` |
| تبلیغات | `/dashboard/ads` |
| اینستاگرام | `/dashboard/social` |
| آمار و نتیجه‌ها | `/dashboard/analytics` |
| شاخص‌ها | `/dashboard/kpi` |
| برند بوک | `/dashboard/brand-book` |
| پیشنهاد کاری | `/dashboard/business-proposal` |
| اپلیکیشن‌ساز | `/dashboard/business-builder` |
| کارهای تکراری | `/dashboard/automation` |
| مدیریت سایت | `/dashboard/site-operations` |

## Deliberately absent

No beginner surface here shows or links to Business Brain
(`/dashboard/business-brain`), the Decision Room (`/dashboard/growth-loop/…`),
Predictive, Marketing or Platform Admin, and no evidence, governance or
mission-control vocabulary appears in any screen. A capture-time guard asserts
this on all eight screenshots.

## Screens

Desktop 1280×900 and mobile 390×844, all at 2× scale, zero horizontal overflow.

| | Desktop | Mobile |
| --- | --- | --- |
| Question | `01-question-desktop.png` | `01-question-mobile.png` |
| Build | `02-build-desktop.png` | `02-build-mobile.png` |
| Grow | `03-grow-desktop.png` | `03-grow-mobile.png` |
| Tools | `04-tools-desktop.png` | `04-tools-mobile.png` |
