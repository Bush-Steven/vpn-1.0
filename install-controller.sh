#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "Run with sudo: sudo bash install-controller.sh"; exit 1; fi
APP_DIR="/opt/trust-no-one-vpn"
install -d -m 755 "$APP_DIR"
install -m 644 server.js package.json trust_no_one_vpn_frontend_hacker.html "$APP_DIR/"
cat >/etc/systemd/system/trust-no-one-vpn-controller.service <<'UNIT'
[Unit]
Description=TRUST NO ONE VPN localhost WireGuard controller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/trust-no-one-vpn
ExecStart=/usr/bin/node /opt/trust-no-one-vpn/server.js
Restart=on-failure
RestartSec=2
Environment=PORT=4173
NoNewPrivileges=false
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
# This controller must remain bound to loopback only.
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now trust-no-one-vpn-controller.service
echo "Controller running at http://127.0.0.1:4173"
echo "Configure /etc/wireguard/wg-home.conf before connecting."
