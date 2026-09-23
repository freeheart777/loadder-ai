# Active Task

**Current focus:** Environment preparation for low-token-usage work on the Loadder Website Builder (V16). No implementation coding has started yet.

**Scope for this task (do not expand):**
- Create `CLAUDE.md` and `.claude/` memory files. (done)
- Verify GitHub access, filesystem access, and existing MCP configuration — install nothing new. (done — GitHub confirmed; no Filesystem MCP needed, native tools suffice; no other MCP config installed)
- Sync repo: `git fetch --all --prune`, verify `origin/main`, fast-forward local `main` only, remove the corrupted stray file `src/pages/StoreWebsiteStudioPageV16.tsx`. (done — HEAD now `570927a`, matches expected)
- Write `docs/BUILD_STATE.md` summarizing branch/commit/discovered modules/next step. (done)
- **Stop. Do not begin coding this session** unless explicitly told to.

**Explicitly out of scope right now:** implementing any Website Builder feature, modifying any file under `src/` or `server/` beyond the one corrupted-file removal, reviewing unrelated modules (CRM, Analytics, Automation, Ads, etc.).

**Next task once this finishes:** to be chosen by the user, informed by `docs/BUILD_STATE.md`'s "next recommended task" section — likely picking up the V16 lineage at the next gate after `codex/v16-component-contract-gate-03` (the current tip of `origin/main`).
