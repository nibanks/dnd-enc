#!/usr/bin/env bash
# D&D Encounter Tracker - Server Startup Script (Linux/macOS)
# Usage: ./scripts/start.sh [--enable-upnp]

set -euo pipefail

# Change to project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

ENABLE_UPNP=""
for arg in "$@"; do
    case "$arg" in
        --enable-upnp|--enable-external|-EnableUpnp)
            ENABLE_UPNP="--enable-upnp"
            ;;
        *)
            ;;
    esac
done

printf '\n\033[32mStarting D&D Encounter Tracker...\033[0m\n'

# Warn if ufw is active but port 5000 is not allowed (other machines won't be able to connect)
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi '^Status: active'; then
    if ! ufw status 2>/dev/null | grep -Eq '(^|\s)5000(/tcp)?\s'; then
        printf '\n\033[33mHeads up: ufw is active but port 5000 is not open.\033[0m\n'
        printf '  Other machines (e.g. spectator view) will not be able to connect.\n'
        printf '  To allow LAN access:  \033[36msudo ./scripts/setup-firewall.sh --lan\033[0m\n'
    fi
fi

if [ -d ".venv" ] && [ -f ".venv/bin/activate" ]; then
    printf '\033[36mActivating virtual environment...\033[0m\n'
    # shellcheck disable=SC1091
    source .venv/bin/activate
else
    printf '\033[33mNo .venv found - using system python. To create one:\033[0m\n'
    printf '  python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt\n'
fi

SSL_CONFIGURED=0
[ -f ".cache/ssl_config.json" ] && SSL_CONFIGURED=1

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "${LOCAL_IP:-}" ] && LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -z "${LOCAL_IP:-}" ] && LOCAL_IP="127.0.0.1"

printf '\n\033[36mServer will be available at:\033[0m\n'
if [ "$SSL_CONFIGURED" = "1" ]; then
    printf '  HTTPS (External): https://nbanks.dev\n'
    printf '  HTTP  (Local):    http://127.0.0.1:5000\n'
    printf '  HTTP  (Network):  http://%s:5000\n' "$LOCAL_IP"
    printf '  Spectator:        http://%s:5000/spectator\n' "$LOCAL_IP"
else
    printf '  Local:     http://127.0.0.1:5000\n'
    printf '  Network:   http://%s:5000\n' "$LOCAL_IP"
    printf '  Spectator: http://%s:5000/spectator\n' "$LOCAL_IP"
fi

printf '\n\033[33mPress Ctrl+C to stop the server\033[0m\n\n'

if [ -n "$ENABLE_UPNP" ]; then
    printf '\033[36mUPnP and Dynamic DNS enabled\033[0m\n\n'
fi

PYTHON_BIN="${PYTHON:-python3}"
exec "$PYTHON_BIN" app.py $ENABLE_UPNP
