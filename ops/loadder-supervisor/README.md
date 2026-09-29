# Loadder Local Supervisor
Polls the active GitHub execution-control issue every 5 minutes and runs only comments containing `[LOADDER-RUN]`. Each marked comment runs once, under a lock, via Codex `workspace-write` + automatic approval review. It never uses danger-full-access.

Install:
```bash
cd /Users/azaddel/Desktop/python-course/make_deck.py/power-ai-hero
git fetch origin
git checkout automation/loadder-local-supervisor -- ops/loadder-supervisor
bash ops/loadder-supervisor/install-macos.sh
```
Requires authenticated `gh`, `jq`, and Codex CLI.

Status/log:
```bash
launchctl print gui/$(id -u)/com.loadder.local-supervisor
tail -f ~/Library/Logs/loadder-supervisor/supervisor.log
```
Disable: `launchctl bootout gui/$(id -u)/com.loadder.local-supervisor`.

Control protocol: a GitHub issue comment must contain `[LOADDER-RUN]`. The runner posts Codex's final report back to that issue.