# CLAUDE.md — Loadder / Website Builder V16

Guidance for Claude Code sessions working in this repository. This file is read automatically at session start — keep it short and durable; put anything task-specific in `.claude/active-task.md` instead.

## Project architecture rules

- **Website Builder core stays independent from AI.** The V16 builder (editor, storefront renderer, persistence, patch engine) must function with zero AI dependency. AI is an optional layer for personalization/content assistance only — never a requirement for core editing, publishing, or storefront rendering to work.
- **`origin/main` is the source of truth for V16 state**, not any local snapshot or feature branch. The V16 lineage was built across many short-lived branches (`commerce/*`, `claude/*`, `codex/*`, `builder/*`) merged sequentially via PRs into `main`. Before assuming a capability is "missing," fetch and check `origin/main` — do not conclude absence from local branches alone.
- The repo has two runtime halves: `src/` (Vite + React + TypeScript frontend) and `server/` (Node.js backend, `server/app/`, `server/db/`, `server/ai/`). Treat them as separate concerns when scoping a task.
- Numbered/gated V16 work (e.g. "Gate 01 persistence foundation," "Gate 02 structured patch engine," "Gate 03 component contract") lands as sequential PRs. When picking up new V16 work, identify which gate is next rather than re-deriving the architecture.

## Token optimization rules

- Never scan the entire repository for a task. Identify the specific files/directories the task touches and read only those.
- Never read unrelated modules (e.g. don't open CRM/Analytics/Automation pages when working on the Website Builder).
- Prefer targeted `grep`/`find`/`git log -- <path>` over broad directory listings or full-file reads when only a symbol, path, or fact is needed.
- Prefer reading `.claude/current-state.md` and `.claude/decisions.md` over re-deriving repo state from scratch each session.
- When a previous investigation already answered a question (recorded in `.claude/decisions.md`), cite it instead of re-running the same git/file searches.
- Summarize findings back to the user instead of pasting large file contents or command output verbatim.

## File reading rules

- Before reading, confirm the file/path is actually required for the current task in `.claude/active-task.md`.
- Read only the specific file(s) named by the task, or files a targeted `grep`/`find` result points to — not entire directories "just in case."
- For git history questions, use `git log`/`git diff --stat`/`git rev-list --count` for scale first; only pull full diffs for the specific commit or branch in question.
- Do not open backup files (`*.bak`), zip archives, or unrelated `LOADDER_*.txt`/`.continue/` tooling-context dumps unless a task specifically concerns them.

## Coding rules

- Do not modify implementation code unless the current task explicitly asks for it. Investigation, verification, and environment/doc setup tasks are read-only or docs-only.
- Keep the Website Builder core and AI-personalization layer in separate modules/files; never inline an AI call into core editor, persistence, or storefront-rendering logic.
- After completing a milestone, update `.claude/current-state.md` (and `docs/BUILD_STATE.md` if it's a repo-sync milestone) rather than leaving state only in chat.
- Record any non-obvious decision (why a branch was preferred, why a file was removed, why an approach was chosen) in `.claude/decisions.md` so future sessions don't re-litigate it.

## Graph-first discovery (Graphify)

Architecture maps and the how-to live in `docs/architecture/` (`LOADDER_RUNTIME_ARCHITECTURE_MAP.md`, `LOADDER_DEPENDENCY_AUDIT.md`, `LOADDER_GRAPHIFY_WORKFLOW.md`). They describe implemented behaviour at a recorded commit; reuse them instead of re-deriving, and update only the section you touched.

- Use the Graphify MCP tools for "where / who imports / what depends" questions, and **always pass `project_path: "/Users/azaddel/Developer/loadder-agent"`** (the server's default graph is another project's).
- Prefer `get_neighbors` with an exact `node_id` and `relation_filter: "imports_from"` and a small `token_budget`. Do not trust `shortest_path` endpoints; verify with `get_neighbors` or a source read.
- Confirm graph findings with a narrow source read (`file:line`). The graph cannot see HTTP calls, SQL, route paths, middleware order, config, tests or Docker.
- Do not read `server/index.mjs` or `server/app/routes/auth.mjs` whole; `grep -n` the symbol and read ~30 lines.
- Before relying on the graph compare `graphify-out/graph.json` `built_at_commit` with `git rev-parse HEAD`; if stale run `graphify update .` (AST only, ~6 s, no LLM). Do not rebuild from scratch. `graphify-out/` is never committed.
- Load skills on demand, smallest set per task. Keep analysis, implementation and verification separate. Never touch runtime data (`server/db/loadder.sqlite`, sidecars, `server/data`, Docker volumes) to inspect architecture. Documentation is intent, not behaviour.
