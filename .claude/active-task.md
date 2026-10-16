# Active Task

**Current focus:** customer-facing visual acceptance and the website-building experience, on top of the finished Website Builder V18.

**Status:**
- Website Builder V18 is implemented and pushed. Latest verified commit: `417e239` (`automation/loadder-roadmap`).
- **No new architecture phase is authorized.** Do not start V19 or a new gate without an explicit instruction.
- Claude workflow optimization (state archive, verification map, UI checklist in `CLAUDE.md`) is documentation-only.

**Scope rules (do not expand):**
- Work only on the files the stated task names. Use the Verification map and UI verification checklist in `CLAUDE.md` before claiming anything is done.
- Do not install skills, plugins or dependencies. Google Agent Skills were audited and rejected.
- Do not touch runtime data: `server/db/loadder.sqlite`, `server/data`, Docker volumes.

**Pointers:** current state `.claude/current-state.md`; history `docs/CURRENT_STATE_ARCHIVE_V16_2026-09.md`; V18 notes `docs/WEBSITE_BUILDER_V18.md`.
