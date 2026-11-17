#!/bin/bash
cd "$(dirname "$0")"
python3 -m http.server 8765 --directory app >/tmp/wsp-preview-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1
open http://127.0.0.1:8765/
wait "$SERVER_PID"
