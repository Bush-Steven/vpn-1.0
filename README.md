# TRUST NO ONE VPN — WireGuard starter

This repository now includes a **real local WireGuard client controller** for the hacker-themed dashboard. The dashboard can query the local interface and request connect/disconnect. It is a self-hosted VPN starter, not a commercial VPN network.

## What works in this stage
- Dashboard served by a Node.js local controller
- Real WireGuard interface state from `wg show wg-home`
- ON/OFF requests run `wg-quick up/down wg-home`
- Actual WireGuard peer byte counters (not simulated)
- Local-only API bound to `127.0.0.1`, host/origin checks, no CORS
- Example client profile and controller service installer

## Requirements
- Linux client (Ubuntu/Debian/Kali) with WireGuard tools
- Node.js 18+
- A WireGuard server endpoint reachable from this client
- Administrator/root service privileges for `wg-quick`

## Client setup
1. Install packages: `sudo apt update && sudo apt install wireguard nodejs npm`
2. Create a client keypair: `umask 077; wg genkey | tee client-private.key | wg pubkey > client-public.key`
3. Use the public key on the server as a peer. Configure a profile based on `wireguard/wg-home.conf.example`; do not put real keys in Git.
4. Install profile: `sudo install -m 600 wg-home.conf /etc/wireguard/wg-home.conf`
5. From this repo, run `sudo bash install-controller.sh`
6. Open **http://127.0.0.1:4173**. The switch will query the actual interface.

## Home server
Run WireGuard on an always-on Linux home server. Set a stable LAN address, enable IPv4 forwarding, configure NAT, and forward UDP 51820 on your router to the server. Use a DDNS hostname if the home IP changes. If your ISP uses CGNAT, ordinary inbound port forwarding will not work; request a public IP or use a mesh VPN/relay option.

Create a unique client key/profile for each computer and phone. Import phone profiles into the official WireGuard app. A browser dashboard cannot directly toggle a phone's system VPN; use the WireGuard mobile app or a native companion app.

## Security notes
- Keep private keys and profile files secret; use permissions `600`.
- Never commit private keys, server configs with private keys, or QR codes to GitHub.
- Do not expose port 4173 to LAN or internet. It runs as root because it calls `wg-quick`; review code before enabling.
- Kill switch and DNS settings shown in the UI are not enforced by this first controller stage; don't treat UI toggles as operating-system protections yet.
- This controller only manages the Linux machine where it is installed, not every device on your network.
