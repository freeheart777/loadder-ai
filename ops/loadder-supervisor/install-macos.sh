#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/Users/azaddel/Desktop/python-course/make_deck.py/power-ai-hero}"
for x in gh jq codex python3; do command -v "$x" >/dev/null||{ echo "Missing $x"; exit 1; }; done
gh auth status >/dev/null 2>&1||{ echo "Run: gh auth login"; exit 1; }
SRC="$ROOT/ops/loadder-supervisor/run.sh"; DEST="$HOME/.local/share/loadder-supervisor"; PLIST="$HOME/Library/LaunchAgents/com.loadder.local-supervisor.plist"
mkdir -p "$DEST" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/loadder-supervisor"; cp "$SRC" "$DEST/run.sh"; chmod 700 "$DEST/run.sh"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.loadder.local-supervisor</string>
<key>ProgramArguments</key><array><string>$DEST/run.sh</string></array>
<key>RunAtLoad</key><true/><key>StartInterval</key><integer>300</integer>
<key>StandardOutPath</key><string>$HOME/Library/Logs/loadder-supervisor/launchd.out.log</string>
<key>StandardErrorPath</key><string>$HOME/Library/Logs/loadder-supervisor/launchd.err.log</string>
<key>EnvironmentVariables</key><dict>
<key>PATH</key><string>/Users/azaddel/.nvm/versions/node/v22.23.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
<key>LOADDER_REPO</key><string>freeheart777/loadder-ai</string><key>LOADDER_ISSUE</key><string>250</string>
<key>LOADDER_WORKTREE</key><string>/private/tmp/loadder-booking-pr6-2</string>
<key>CODEX_BIN</key><string>/Users/azaddel/.nvm/versions/node/v22.23.2/bin/codex</string>
<key>LOADDER_MAX_SECONDS</key><string>2700</string>
<key>LOADDER_MAX_RETRIES</key><string>2</string>
</dict></dict></plist>
EOF
launchctl bootout "gui/$(id -u)/com.loadder.local-supervisor" 2>/dev/null||true
launchctl bootstrap "gui/$(id -u)" "$PLIST"; launchctl kickstart -k "gui/$(id -u)/com.loadder.local-supervisor"
echo "Installed. Log: tail -f ~/Library/Logs/loadder-supervisor/supervisor.log"
