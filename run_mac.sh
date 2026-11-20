#!/usr/bin/env bash
# Run CyberX SIEM (backend + dashboard) on macOS.
# Usage: ./run_mac.sh          (API on first free port from 5001, dashboard on 3000)
#        SIEM_PORT=5002 DASH_PORT=3001 ./run_mac.sh
#        AGENT=0 ./run_mac.sh   (don't start the Mac log agent)
# Starts at 5001 because macOS AirPlay Receiver occupies 5000.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
DASH_PORT="${DASH_PORT:-3000}"

command -v python3 >/dev/null || { echo "python3 not found (brew install python)"; exit 1; }
command -v npm >/dev/null || { echo "npm not found (brew install node)"; exit 1; }

# A real bind test (lsof can't see ports held by other users/system services).
port_free() {
  python3 -c "import socket,sys
s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try: s.bind(('0.0.0.0', int(sys.argv[1])))
except OSError: sys.exit(1)" "$1"
}

if [ -z "$SIEM_PORT" ]; then      # auto-pick: first free port from 5001
  for p in $(seq 5001 5010); do
    if port_free "$p"; then SIEM_PORT=$p; break; fi
  done
  [ -n "$SIEM_PORT" ] || { echo "No free port in 5001-5010. Set SIEM_PORT=<port>."; exit 1; }
elif ! port_free "$SIEM_PORT"; then
  echo "Port $SIEM_PORT is already in use. Pick another: SIEM_PORT=<port> ./run_mac.sh"; exit 1
fi
if ! port_free "$DASH_PORT"; then
  echo "Port $DASH_PORT is already in use. Pick another: DASH_PORT=<port> ./run_mac.sh"; exit 1
fi
export SIEM_PORT
export REACT_APP_SIEM_URL="http://127.0.0.1:${SIEM_PORT}"

cd "$ROOT/siem_server"
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install -q --disable-pip-version-check -r requirements.txt

cd "$ROOT/siem_dashboard"
[ -d node_modules ] || npm install

kill_tree() {  # kill a process and all its descendants
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
cleanup() {
  trap - EXIT INT TERM
  [ -n "$SERVER_PID" ] && kill_tree "$SERVER_PID"
  [ -n "$DASH_PID" ] && kill_tree "$DASH_PID"
  [ -n "$AGENT_PID" ] && kill_tree "$AGENT_PID"
}
trap cleanup EXIT INT TERM

cd "$ROOT/siem_server"
./venv/bin/python app.py &
SERVER_PID=$!

if [ "${AGENT:-1}" != "0" ]; then   # live Mac events -> SIEM (disable: AGENT=0)
  sleep 3
  SIEM_URL="$REACT_APP_SIEM_URL" LOOKBACK_SECS=30 \
    ./venv/bin/python -u "$ROOT/siem_agent/mac_agent.py" > >(sed -l 's/^/[mac-agent] /') 2>&1 &
  AGENT_PID=$!
fi

cd "$ROOT/siem_dashboard"
echo "Dashboard: http://localhost:${DASH_PORT}  |  API: $REACT_APP_SIEM_URL"
echo "Test attacks (2nd terminal): siem_server/venv/bin/python scripts/simulate_attack.py --url $REACT_APP_SIEM_URL/api/logs"
PORT="$DASH_PORT" npm start &
DASH_PID=$!
wait "$DASH_PID"
