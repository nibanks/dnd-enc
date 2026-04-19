#!/usr/bin/env bash
# D&D Encounter Tracker - Firewall Setup Script (Linux)
#
# Opens port 5000/tcp so other machines on the LAN can reach the Flask server
# (e.g. the spectator view at http://<server-ip>:5000/spectator).
#
# Supports ufw (Debian/Ubuntu), firewalld (Fedora/RHEL), and a raw iptables
# fallback. Safe to run multiple times - existing rules are replaced.
#
# Usage:
#   sudo ./scripts/setup-firewall.sh                # allow 5000/tcp from anywhere
#   sudo ./scripts/setup-firewall.sh --lan          # allow only from RFC1918 LAN subnets
#   sudo ./scripts/setup-firewall.sh --subnet 192.168.1.0/24
#   sudo ./scripts/setup-firewall.sh --remove       # remove the rule(s)
#   ./scripts/setup-firewall.sh --status            # show current status (no sudo needed if ufw permits)

set -euo pipefail

PORT="5000"
RULE_COMMENT="DnD Encounter Tracker"
ACTION="add"
SCOPE="any"      # any | lan | custom
SUBNETS=()
LAN_SUBNETS=("192.168.0.0/16" "10.0.0.0/8" "172.16.0.0/12")

c_red=$'\033[31m'; c_green=$'\033[32m'; c_yellow=$'\033[33m'
c_cyan=$'\033[36m'; c_bold=$'\033[1m'; c_reset=$'\033[0m'

log()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s!%s %s\n' "$c_yellow" "$c_reset" "$*"; }
err()  { printf '%s✗%s %s\n' "$c_red" "$c_reset" "$*" 1>&2; }
info() { printf '%s%s%s\n' "$c_cyan" "$*" "$c_reset"; }

usage() {
    sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

while [ $# -gt 0 ]; do
    case "$1" in
        --remove|--delete|-r)   ACTION="remove" ;;
        --status|-s)            ACTION="status" ;;
        --lan)                  SCOPE="lan" ;;
        --subnet)               SCOPE="custom"; SUBNETS+=("${2:?--subnet requires a CIDR argument}"); shift ;;
        --port)                 PORT="${2:?--port requires a value}"; shift ;;
        -h|--help)              usage ;;
        *)                      err "Unknown argument: $1"; exit 2 ;;
    esac
    shift
done

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        err "This action needs root. Re-run with: sudo $0 $*"
        exit 1
    fi
}

detect_backend() {
    if command -v ufw >/dev/null 2>&1 && systemctl is-active --quiet ufw 2>/dev/null; then
        echo "ufw"; return
    fi
    if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi '^Status: active'; then
        echo "ufw"; return
    fi
    if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
        echo "firewalld"; return
    fi
    if command -v ufw >/dev/null 2>&1; then
        echo "ufw-inactive"; return
    fi
    if command -v iptables >/dev/null 2>&1; then
        echo "iptables"; return
    fi
    echo "none"
}

resolve_subnets() {
    case "$SCOPE" in
        any)    SUBNETS=() ;;
        lan)    SUBNETS=("${LAN_SUBNETS[@]}") ;;
        custom) : ;;
    esac
}

ufw_add() {
    if [ ${#SUBNETS[@]} -eq 0 ]; then
        ufw delete allow "${PORT}/tcp" >/dev/null 2>&1 || true
        ufw allow "${PORT}/tcp" comment "$RULE_COMMENT"
    else
        for net in "${SUBNETS[@]}"; do
            ufw delete allow from "$net" to any port "$PORT" proto tcp >/dev/null 2>&1 || true
            ufw allow from "$net" to any port "$PORT" proto tcp comment "$RULE_COMMENT"
        done
    fi
}

ufw_remove() {
    ufw delete allow "${PORT}/tcp" >/dev/null 2>&1 || true
    for net in "${LAN_SUBNETS[@]}" "${SUBNETS[@]:-}"; do
        [ -z "$net" ] && continue
        ufw delete allow from "$net" to any port "$PORT" proto tcp >/dev/null 2>&1 || true
    done
}

firewalld_add() {
    if [ ${#SUBNETS[@]} -eq 0 ]; then
        firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null
    else
        for net in "${SUBNETS[@]}"; do
            firewall-cmd --permanent --zone=trusted --add-source="$net" >/dev/null || true
        done
        firewall-cmd --permanent --zone=trusted --add-port="${PORT}/tcp" >/dev/null
    fi
    firewall-cmd --reload >/dev/null
}

firewalld_remove() {
    firewall-cmd --permanent --remove-port="${PORT}/tcp" >/dev/null 2>&1 || true
    firewall-cmd --permanent --zone=trusted --remove-port="${PORT}/tcp" >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null
}

iptables_add() {
    if [ ${#SUBNETS[@]} -eq 0 ]; then
        iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null \
            || iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT
    else
        for net in "${SUBNETS[@]}"; do
            iptables -C INPUT -s "$net" -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null \
                || iptables -I INPUT -s "$net" -p tcp --dport "$PORT" -j ACCEPT
        done
    fi
    warn "iptables rules are not persisted. Install iptables-persistent to keep them across reboots."
}

iptables_remove() {
    while iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null; do
        iptables -D INPUT -p tcp --dport "$PORT" -j ACCEPT
    done
    for net in "${LAN_SUBNETS[@]}" "${SUBNETS[@]:-}"; do
        [ -z "$net" ] && continue
        while iptables -C INPUT -s "$net" -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null; do
            iptables -D INPUT -s "$net" -p tcp --dport "$PORT" -j ACCEPT
        done
    done
}

show_status() {
    local backend; backend="$(detect_backend)"
    info "Detected firewall backend: $backend"
    case "$backend" in
        ufw|ufw-inactive)
            ufw status verbose 2>&1 | sed 's/^/  /' || true
            ;;
        firewalld)
            firewall-cmd --list-all 2>&1 | sed 's/^/  /' || true
            ;;
        iptables)
            iptables -L INPUT -n -v 2>&1 | sed 's/^/  /' || true
            ;;
        *)
            warn "No supported firewall tool found."
            ;;
    esac

    local ip
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -n "${ip:-}" ] && info "Server LAN URL: http://${ip}:${PORT}/spectator"
}

main() {
    resolve_subnets

    if [ "$ACTION" = "status" ]; then
        show_status
        exit 0
    fi

    require_root "$@"
    local backend; backend="$(detect_backend)"
    info "Firewall backend: $backend  |  port: ${PORT}/tcp  |  scope: ${SCOPE}"

    case "$backend" in
        ufw)
            if [ "$ACTION" = "add" ]; then ufw_add; else ufw_remove; fi
            ;;
        ufw-inactive)
            warn "ufw is installed but not active. Enabling it now (this may close other ports)."
            warn "If you're on a remote SSH session, make sure SSH is allowed first: sudo ufw allow OpenSSH"
            if [ "$ACTION" = "add" ]; then ufw_add; ufw --force enable; else ufw_remove; fi
            ;;
        firewalld)
            if [ "$ACTION" = "add" ]; then firewalld_add; else firewalld_remove; fi
            ;;
        iptables)
            if [ "$ACTION" = "add" ]; then iptables_add; else iptables_remove; fi
            ;;
        *)
            err "No supported firewall tool (ufw/firewalld/iptables) found. Nothing to do."
            exit 1
            ;;
    esac

    if [ "$ACTION" = "add" ]; then
        ok "Port ${PORT}/tcp is now allowed."
    else
        ok "Port ${PORT}/tcp rules removed."
    fi

    echo
    show_status
}

main "$@"
