# Loadder Local Supervisor v2

A guarded local Codex execution loop driven by GitHub Issue comments.

## Control protocol

Only comments containing the exact marker `[LOADDER-RUN]` are executable. The runner processes them **FIFO**, records every attempt in a local ledger, posts the final Codex report back to GitHub, and never executes two tasks concurrently.

## v2 reliability

- FIFO instruction queue instead of "latest comment wins".
- Durable JSON ledger under `~/.local/state/loadder-supervisor/ledger.json`.
- Up to 2 attempts per instruction by default.
- 45-minute hard timeout per Codex execution by default.
- Failed/timeout instructions are never silently marked successful.
- Exhausted retries require supervisor/manual review.
- Per-attempt JSONL traces under `~/Library/Logs/loadder-supervisor/`.
- Lock directory prevents overlapping Codex sessions.
- Uses Codex `--approve-for-me`; never danger-full-access.
- Production deploy, main merge, secrets, destructive data changes and runtime-artifact commits remain prohibited by the execution contract.

Environment overrides:
- `LOADDER_REPO`
- `LOADDER_ISSUE`
- `LOADDER_WORKTREE`
- `CODEX_BIN`
- `LOADDER_MAX_SECONDS` (default 2700)
- `LOADDER_MAX_RETRIES` (default 2)

## Install/update

```bash
cd /Users/azaddel/Desktop/python-course/make_deck.py/power-ai-hero
git fetch origin
git checkout origin/automation/loadder-local-supervisor -- ops/loadder-supervisor
bash ops/loadder-supervisor/install-macos.sh
```

Requires authenticated `gh`, `jq`, `python3`, and Codex CLI.

## Status

```bash
launchctl print gui/$(id -u)/com.loadder.local-supervisor
tail -f ~/Library/Logs/loadder-supervisor/supervisor.log
cat ~/.local/state/loadder-supervisor/ledger.json | jq
```

Disable:

```bash
launchctl bootout gui/$(id -u)/com.loadder.local-supervisor
```

The GitHub/ChatGPT supervisor remains responsible for deciding the next product task. The local runner deliberately does not invent roadmap work on its own.
