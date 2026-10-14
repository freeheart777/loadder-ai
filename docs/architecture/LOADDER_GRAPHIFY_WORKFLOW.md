# Graphify workflow for Loadder

How to use the code knowledge graph to answer architecture questions with few tokens, what it can and cannot tell you, and how to keep it fresh. Companion to the [runtime map](LOADDER_RUNTIME_ARCHITECTURE_MAP.md) and the [dependency audit](LOADDER_DEPENDENCY_AUDIT.md).

## 1. State at the time of writing

| Item | Value |
|---|---|
| Tool | `graphify` CLI 0.9.67 (`~/.local/bin/graphify`), skill installed at `~/.claude/skills/graphify` |
| MCP server | registered at user level as `graphify` (`graphify-mcp <graph.json>`); **its default graph path points to a different project's graph that does not exist** |
| Loadder graph | `graphify-out/graph.json` (git-ignored, local), `built_at_commit` `5f62b94…`, 6,005 nodes, 12,363 edges, 373 communities, built with `graphify update .` in ~6 s, **AST only, no LLM, no API key** |
| Scope | `src/` and `server/` source plus root configs. Excludes tests, e2e, runtime data, secrets, media, backups (`.graphifyignore`) |

## 2. Build, freshness and refresh

```bash
# build or incrementally refresh (AST only, ~6 s, no network, no LLM)
graphify update .

# is the graph current? compare the commit it was built from with HEAD
python3 - <<'EOF'
import json,subprocess
g=json.load(open("graphify-out/graph.json"))
head=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
print("graph:",g["built_at_commit"][:12],"HEAD:",head[:12],"FRESH" if g["built_at_commit"]==head else "STALE (run graphify update .)")
EOF
```

- Reuse the graph if `built_at_commit == HEAD` and `.graphifyignore` is unchanged. Otherwise run `graphify update .`; do not rebuild from scratch.
- Refresh after a meaningful change (new module, moved files, new router, merge/rebase), not after every edit. The stamp is the commit, not the worktree: uncommitted edits are not distinguished, so for work in progress check `git status` and read the changed files directly.
- Never commit `graphify-out/` (already ignored). Never run `/graphify` document extraction on `docs/` for architecture questions: it needs an LLM and adds noise.

## 3. Using the MCP tools (rules learned by testing)

Every call **must** pass `project_path: "/Users/azaddel/Developer/loadder-agent"`. Without it the server uses its default graph path, which is not Loadder's.

| Tool | Verdict | How to use it |
|---|---|---|
| `graph_stats` | Reliable | First call; confirms nodes/edges/communities and that the right graph is loaded. |
| `get_node` | Reliable for files | Label like `booking-repository.mjs` resolves to the file node (id, source, degree). |
| `get_neighbors` | **Most useful and reliable** | Prefer `node_id` (exact) plus `relation_filter: "imports_from"` and a small `token_budget`. Output is directional (`-->` imports, `<--` imported-by) and line-anchored. |
| `god_nodes` | Reliable, noisy | Mixes in documentation heading nodes; use `top_n` small. |
| `query_graph` | Use sparingly | Keyword BFS; useful for orientation, weak for precise dependency answers. |
| `shortest_path` | **Do not trust for endpoint-sensitive questions** | Endpoints are fuzzy-matched: an exact file id (`server_app_routes_site_projects`) resolved to the symbol `projects`, and a booking query returned a path ending in an unrelated `booking()` function. Verify every path with `get_neighbors` or a source read. |

Node id convention for files: path with `/` and `.` replaced by `_`, extension dropped, e.g. `server_app_routes_booking`, `server_app_repositories_booking_repository`, `src_pages_controlcenterpage`; `server/index.mjs` is `server_index_mjs_server_index`.

Direction matters: a function node has no edge *up* to its file (the file `contains` it). Ask file-to-file questions, e.g. "who imports X" = in-edges on X's file node.

### What the graph answers well
- Who imports this module (blast radius) and what does it import.
- Which files are composition roots or hotspots (fan-in/fan-out).
- Cross-directory coupling and import cycles (the graph file can be analysed offline with a few lines of Python; see the audit for numbers).

### What it cannot answer (go to source)
- Frontend → backend calls (HTTP strings), route path → handler, SQL tables and joins, config/env behaviour, runtime ordering (e.g. middleware order in `server/index.mjs`), tests, Docker.
- Anything needing `dynamic_import` / `INFERRED` edges to be certain.

## 4. Token-efficient working procedure

1. **Graph first** for "where / who uses / what depends": `graph_stats` once, then `get_neighbors` on the specific node.
2. **Confirm with a narrow source read** of only the lines the graph points to (`Read` with `offset/limit`, or `grep -n` on one file). Cite `file:line`.
3. **Do not read `server/index.mjs` (77 KB) or `server/app/routes/auth.mjs` whole.** Use `grep -n` for the symbol, then read ~30 lines. The runtime map already records the middleware order.
4. **Reuse the architecture documents** in this folder instead of re-deriving; update only the touched section.
5. Keep analysis, implementation and verification as separate steps; do not change code while investigating.
6. Never touch runtime data (`server/db/loadder.sqlite` and sidecars, `server/data`, Docker volumes) to answer an architecture question.
7. Documentation is intent, not behaviour: if a doc and the code disagree, the code (and a test) wins; record the disagreement.

## 5. Measured comparison (honest)

Sizes are bytes of tool output in this repository, a proxy for tokens (roughly 3-4 bytes per token for this mix of code and Persian text). Per-call token usage is not exposed to the agent, so no token or cost figure is claimed.

| Question | Conventional approach | Graph approach | Result |
|---|---|---|---|
| Who imports `booking-repository`? | `grep -rn` over `src` and `server`: 2.5 KB, 19 files **including tests** | `get_neighbors(imports_from)`: ~2.3 KB unfiltered, 5 source importers, tests excluded | **No meaningful saving**; the graph is more precise (no tests), not smaller |
| What does `site-builder-control-plane.mjs` wire? | Read the file: 7.5 KB | `get_neighbors` with a 1,200-token budget: 34 of 42 imports, ~3 KB | Roughly 2x smaller, loses the tail unless re-queried |
| What is `server/index.mjs` composed of? | Read the file: 76.8 KB (3,681 lines) | `get_neighbors` on its file node plus targeted `grep -n`: a few KB | **Large saving** (order of 10-25x) for the big composition root |
| Overall landscape | n/a | `graph_stats` 105 B, `god_nodes(15)` ~0.7 KB | Cheap orientation; `GRAPH_REPORT.md` is 77 KB, do not read it whole |

Conclusion: the graph pays off for large files, fan-in/fan-out and cross-domain questions. For single-symbol lookups `grep -n` is just as cheap; use whichever is narrower. These are single measurements on one repository, not a benchmark.

## 6. Skill selection (load on demand, never all)

Inventory is large (project, plugin and user skills; the list is in the session's skill listing and is not duplicated here). Pick the smallest set per task. Skills not needed for the task are not loaded.

| Task | Use | Notes |
|---|---|---|
| Orientation, "where is X", dependency questions | **graphify** (MCP tools above) | Skill file only needed to build/refresh the graph |
| Structure of one large file | `claude-mem:smart-explore` (AST outline) | Cheaper than reading the file |
| Architecture or coupling review | `loadder-architecture-review`, `architecture-guardian` | After graph queries have narrowed the area |
| Cross-feature duplication audit | `claude-mem:pathfinder` | Heavy; only for explicit "unify/duplication" work |
| Security review of a diff | `security-review` | Also read the security-sensitive list in the audit |
| Tests, gates, verification | `testing-gates` | Run the smallest relevant tests first |
| Website builder / commerce changes | `website-builder-v16`, `commerce-platform` | Only when editing those areas |
| Token discipline reminder | `token-optimizer` | Already summarised in `CLAUDE.md` |
| Code review / simplification | `code-review`, `simplify` | Implementation phase, not discovery |
| GitHub issues/PRs | GitHub MCP tools; `claude-mem:babysit` for a PR watch | Read `AGENTS.md` preflight first (issues #98, #159) |
| Docker/deployment review | no dedicated skill present; use the `docs/DOCKER_D1.md` and the runtime map | |

Skills actually loaded while producing these documents: `graphify` only.

## 7. Optional hardening (not done)

- The user-level MCP entry points at a non-existent default graph. A project-scoped `.mcp.json` with a relative path (`graphify-mcp graphify-out/graph.json`) would make Loadder sessions default to the right graph. It changes tool configuration and needs an approval/restart, so it was **not** created; the explicit `project_path` rule above is sufficient and safe.
- A CI or hook step that fails when `built_at_commit != HEAD` is possible but unnecessary while refresh is a 6-second manual command.

## 8. Troubleshooting

| Symptom | Cause / action |
|---|---|
| `graph.json not found` | No graph for that path; run `graphify update .` in the repo, and pass `project_path`. |
| Results describe another project | Missing `project_path` (default graph). |
| Path query returns something odd | Fuzzy endpoint matching; verify with `get_neighbors` / source. |
| Stale or missing new files | `graphify update .`; confirm `built_at_commit`. |
| Graph unexpectedly small | A guard refuses to shrink `graph.json` after file deletions; re-run with `--force` only if the shrink is intended. |
