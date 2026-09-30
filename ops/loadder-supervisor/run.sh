#!/usr/bin/env bash
set -euo pipefail

REPO="${LOADDER_REPO:-freeheart777/loadder-ai}"
ISSUE="${LOADDER_ISSUE:-250}"
WORKTREE="${LOADDER_WORKTREE:-/private/tmp/loadder-booking-pr6-2}"
CODEX="${CODEX_BIN:-/Users/azaddel/.nvm/versions/node/v22.23.2/bin/codex}"
MAX_SECONDS="${LOADDER_MAX_SECONDS:-2700}"
MAX_RETRIES="${LOADDER_MAX_RETRIES:-2}"
STATE="$HOME/.local/state/loadder-supervisor"
LOG="$HOME/Library/Logs/loadder-supervisor"
LOCK="$STATE/lock"
LEDGER="$STATE/ledger.json"
mkdir -p "$STATE" "$LOG"
[[ -f "$LEDGER" ]] || printf '{}\n' >"$LEDGER"

log(){ printf '[%s] %s\n' "$(date '+%F %T')" "$*" >>"$LOG/supervisor.log"; }
cleanup(){ rmdir "$LOCK" 2>/dev/null || true; }
if ! mkdir "$LOCK" 2>/dev/null; then exit 0; fi
trap cleanup EXIT

for x in gh jq python3; do command -v "$x" >/dev/null || { log "missing dependency: $x"; exit 20; }; done
"$CODEX" --version >/dev/null || { log "codex unavailable"; exit 21; }
git -C "$WORKTREE" rev-parse --is-inside-work-tree >/dev/null || { log "invalid worktree: $WORKTREE"; exit 22; }

comments="$(gh api --paginate "repos/$REPO/issues/$ISSUE/comments?per_page=100")"
# Bootstrap ledger from historical successful Local Supervisor reports so v2
# never replays already-completed v1 instructions after an upgrade.
success_ids="$(jq -r '[.[] | select(.body|contains("## Local Supervisor execution")) | select(.body|contains("Exit: `0`")) | .body | capture("issuecomment-(?<id>[0-9]+)").id] | unique[]?' <<<"$comments")"
if [[ -n "$success_ids" ]]; then
  tmp_seed="$(mktemp)"
  cp "$LEDGER" "$tmp_seed"
  while IFS= read -r sid; do
    [[ -n "$sid" ]] || continue
    next="$(mktemp)"
    jq --arg id "$sid" '.[$id]=((.[$id] // {}) + {status:"success",migrated_from_v1:true}) | .[$id].attempts = ([.[$id].attempts // 0, 1] | max)' "$tmp_seed" >"$next"
    mv "$next" "$tmp_seed"
  done <<<"$success_ids"
  mv "$tmp_seed" "$LEDGER"
fi
# FIFO queue: oldest executable instruction that has not succeeded and has retries left.
row="$(jq -r --argjson ledger "$(cat "$LEDGER")" --argjson max "$MAX_RETRIES" '
  [ .[] | select(.body|contains("[LOADDER-RUN]"))
    | . + {attempts: ($ledger[(.id|tostring)].attempts // 0), status: ($ledger[(.id|tostring)].status // "pending")}
    | select(.status != "success" and .status != "superseded" and .attempts < $max)
  ] | first // empty | "\(.id)\u001f\(.html_url)\u001f\(.body)"
' <<<"$comments")"
[[ -n "$row" ]] || exit 0

id="${row%%$'\x1f'*}"; rest="${row#*$'\x1f'}"; url="${rest%%$'\x1f'*}"; body="${rest#*$'\x1f'}"
attempts="$(jq -r --arg id "$id" '.[$id].attempts // 0' "$LEDGER")"; attempt=$((attempts+1))
tmp_ledger="$(mktemp)"
jq --arg id "$id" --argjson n "$attempt" --arg at "$(date -u '+%FT%TZ')"   '.[$id] = ((.[$id] // {}) + {attempts:$n,status:"running",started_at:$at})' "$LEDGER" >"$tmp_ledger"
mv "$tmp_ledger" "$LEDGER"

issue="$(gh issue view "$ISSUE" -R "$REPO" --json title,body,url --jq '"# "+.title+"\n"+.url+"\n\n"+.body')"
prompt="$(mktemp)"; result="$(mktemp)"; trace="$LOG/codex-$id-attempt-$attempt.jsonl"
trap 'rm -f "$prompt" "$result"; cleanup' EXIT
cat >"$prompt" <<EOF
You are the Loadder implementation agent. Work only in $WORKTREE.
Execution-control issue:
$issue

EXECUTABLE SUPERVISOR INSTRUCTION ($url), attempt $attempt/$MAX_RETRIES:
$body

Read applicable local SpecDD contracts first.
Never reset/clean/stash unrelated work. Never merge main, deploy production, modify secrets, delete data, or commit runtime SQLite/WAL/SHM/server/data/dist/node_modules/temp artifacts.
Execute only this instruction. Validate it fully. Commit coherent source/test changes only when their gates pass. Report exact evidence, commits, blockers, and customer-ready status when requested. STOP after this instruction.
EOF

log "starting instruction $id attempt $attempt/$MAX_RETRIES"
set +e
python3 - "$CODEX" "$WORKTREE" "$prompt" "$result" "$trace" "$MAX_SECONDS" <<'PY'
import subprocess,sys
codex,worktree,prompt,result,trace,limit=sys.argv[1:]
with open(prompt,"rb") as inp, open(trace,"wb") as out:
    cmd=[codex,"exec","--cd",worktree,"--approve-for-me","--json","-o",result,"-"]
    try:
        p=subprocess.run(cmd,stdin=inp,stdout=out,stderr=subprocess.STDOUT,timeout=int(limit))
        raise SystemExit(p.returncode)
    except subprocess.TimeoutExpired:
        out.write(b'\n{"type":"supervisor_timeout"}\n')
        raise SystemExit(124)
PY
rc=$?
set -e

report="$(cat "$result" 2>/dev/null || true)"
[[ -n "$report" ]] || report="Codex exited $rc without a final message. Trace: $trace"
status="failed"
if [[ "$rc" -eq 0 ]]; then
  if grep -Eiq '(^|[[:space:]])(BLOCKED|CUSTOMER-READY:[[:space:]]*NO|: BLOCKED|— .*BLOCKED)' "$result" 2>/dev/null; then
    status="blocked"
  else
    status="success"
  fi
fi
tmp_ledger="$(mktemp)"
jq --arg id "$id" --arg status "$status" --arg at "$(date -u '+%FT%TZ')" --argjson rc "$rc"   '.[$id] = ((.[$id] // {}) + {status:$status,finished_at:$at,exit_code:$rc})' "$LEDGER" >"$tmp_ledger"
mv "$tmp_ledger" "$LEDGER"

comment="$(mktemp)"
{
  printf '## Local Supervisor v2 execution\n\n'
  printf 'Instruction: %s\n\nAttempt: `%s/%s`  \nExit: `%s`  \nStatus: **%s**\n\n' "$url" "$attempt" "$MAX_RETRIES" "$rc" "$status"
  printf '%s\n' "$report"
  if [[ "$status" != "success" && "$attempt" -ge "$MAX_RETRIES" ]]; then
    printf '\n> Supervisor v2 exhausted automatic retries. Manual/supervisor review required.\n'
  fi
} >"$comment"
gh issue comment "$ISSUE" -R "$REPO" --body-file "$comment" >/dev/null
rm -f "$comment"
log "finished instruction $id attempt $attempt rc=$rc status=$status"
exit "$rc"
