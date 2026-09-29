#!/usr/bin/env bash
set -euo pipefail
REPO="${LOADDER_REPO:-freeheart777/loadder-ai}"; ISSUE="${LOADDER_ISSUE:-250}"
WORKTREE="${LOADDER_WORKTREE:-/private/tmp/loadder-booking-pr6-2}"
CODEX="${CODEX_BIN:-/Users/azaddel/.nvm/versions/node/v22.23.2/bin/codex}"
STATE="$HOME/.local/state/loadder-supervisor"; LOG="$HOME/Library/Logs/loadder-supervisor"
mkdir -p "$STATE" "$LOG"
log(){ echo "[$(date '+%F %T')] $*" >>"$LOG/supervisor.log"; }
if ! mkdir "$STATE/lock" 2>/dev/null; then exit 0; fi
trap 'rmdir "$STATE/lock" 2>/dev/null || true' EXIT
command -v gh >/dev/null; command -v jq >/dev/null; "$CODEX" --version >/dev/null
git -C "$WORKTREE" rev-parse --is-inside-work-tree >/dev/null
j="$(gh api --paginate "repos/$REPO/issues/$ISSUE/comments?per_page=100")"
row="$(printf '%s' "$j"|jq -r '[.[]|select(.body|contains("[LOADDER-RUN]"))]|last//empty|"\(.id)\u001f\(.html_url)\u001f\(.body)"')"
[[ -n "$row" ]]||exit 0
id="${row%%$'\x1f'*}"; rest="${row#*$'\x1f'}"; url="${rest%%$'\x1f'*}"; body="${rest#*$'\x1f'}"
[[ "$id" != "$(cat "$STATE/last" 2>/dev/null||true)" ]]||exit 0
issue="$(gh issue view "$ISSUE" -R "$REPO" --json title,body,url --jq '"# "+.title+"\n"+.url+"\n\n"+.body')"
prompt="$(mktemp)"; result="$(mktemp)"; trace="$LOG/codex-$id.jsonl"
trap 'rm -f "$prompt" "$result"; rmdir "$STATE/lock" 2>/dev/null||true' EXIT
cat >"$prompt" <<EOF
You are the Loadder implementation agent. Work only in $WORKTREE.
Execution-control issue:
$issue
LATEST EXECUTABLE SUPERVISOR INSTRUCTION ($url):
$body
Read applicable local SpecDD contracts first.
Never reset/clean/stash unrelated work. Never merge main, deploy production, modify secrets, delete data, or commit runtime SQLite/WAL/SHM/server/data/dist/node_modules/temp artifacts.
Execute only this instruction, validate it fully, commit coherent source/test changes when gates pass, report exact evidence/commits/blockers, then STOP.
EOF
log "starting instruction $id"
set +e
"$CODEX" exec --cd "$WORKTREE" --sandbox workspace-write --approve-for-me --json -o "$result" - <"$prompt" >"$trace" 2>>"$LOG/supervisor.log"
rc=$?
set -e
report="$(cat "$result" 2>/dev/null||true)"; [[ -n "$report" ]]||report="Codex exited $rc without final message. Trace: $trace"
printf '%s\n' "$id" >"$STATE/last"
tmp="$(mktemp)"; printf '## Local Supervisor execution\n\nInstruction: %s\n\nExit: `%s`\n\n%s\n' "$url" "$rc" "$report" >"$tmp"
gh issue comment "$ISSUE" -R "$REPO" --body-file "$tmp" >/dev/null
rm -f "$tmp"; log "finished instruction $id rc=$rc"; exit "$rc"
