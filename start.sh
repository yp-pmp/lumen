#!/usr/bin/env bash
# Start LUMEN locally and open it in your browser.
#
#   ./start.sh            → http://localhost:4173, this Mac only
#   ./start.sh 8080       → a port of your choosing
#   ./start.sh --lan      → also reachable from your phone on the same Wi-Fi
#
# The app itself never makes a network request. --lan only decides who can
# load it: loopback (just this Mac) or your local network.

set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "LUMEN needs python3 to serve this folder. Any static server works too." >&2
  exit 1
fi

exec python3 serve.py "$@"
