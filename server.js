'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const IFACE = 'wg-home'; // fixed interface; never accept shell commands or interface names from requests
const UI_FILE = path.join(__dirname, 'trust_no_one_vpn_frontend_hacker.html');

function run(command, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error((stderr || error.message || '').trim()));
      resolve(String(stdout || '').trim());
    });
  });
}
function parseTransfer(output) {
  // "wg show <iface> transfer" returns one row per peer: public-key received sent
  let received = 0, sent = 0;
  for (const line of output.split(/\\r?\\n/)) {
    const parts = line.trim().split(/\\s+/);
    if (parts.length >= 3) {
      const rx = Number(parts[1]), tx = Number(parts[2]);
      if (Number.isFinite(rx)) received += rx;
      if (Number.isFinite(tx)) sent += tx;
    }
  }
  return { received, sent };
}
function localRequest(req) {
  const address = req.socket.remoteAddress || '';
  const isLoopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  const origin = req.headers.origin;
  const allowedOrigin = !origin || origin === `http://127.0.0.1:${PORT}` || origin === `http://localhost:${PORT}`;
  const host = req.headers.host;
  const allowedHost = host === `127.0.0.1:${PORT}` || host === `localhost:${PORT}`;
  return isLoopback && allowedOrigin && allowedHost;
}
function json(res, code, value) {
  res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
  res.end(JSON.stringify(value));
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (!localRequest(req)) return json(res, 403, { error:'Local controller access only' });

  if (req.method === 'GET' && req.url === '/api/status') {
    try {
      const [show, transfer] = await Promise.all([
        run('wg', ['show', IFACE]),
        run('wg', ['show', IFACE, 'transfer']).catch(() => '')
      ]);
      const stats = parseTransfer(transfer);
      const handshake = (show.match(/latest handshake: (.+)/) || [])[1] || 'Never';
      return json(res, 200, { connected:true, interface:IFACE, latestHandshake:handshake, receivedBytes:stats.received, sentBytes:stats.sent });
    } catch {
      return json(res, 200, { connected:false, interface:IFACE, latestHandshake:'Never', receivedBytes:0, sentBytes:0 });
    }
  }

  if (req.method === 'POST' && (req.url === '/api/connect' || req.url === '/api/disconnect')) {
    // Reject request bodies; this API accepts no user-supplied command arguments.
    let bodySize = 0;
    req.on('data', chunk => { bodySize += chunk.length; if (bodySize > 1024) req.destroy(); });
    req.on('end', async () => {
      const action = req.url === '/api/connect' ? 'up' : 'down';
      try {
        await run('wg-quick', [action, IFACE], 30000);
        return json(res, 200, { ok:true, connected:action === 'up', message:action === 'up' ? 'WireGuard interface started' : 'WireGuard interface stopped' });
      } catch (error) {
        return json(res, 500, { ok:false, error:error.message, hint:'Install WireGuard and create /etc/wireguard/wg-home.conf. Run this localhost controller with administrator privileges.' });
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    if (!fs.existsSync(UI_FILE)) return json(res, 500, { error:'VPN dashboard file is missing' });
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
    return fs.createReadStream(UI_FILE).pipe(res);
  }
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok:true, controller:'trust-no-one-local' });
  if (req.method === 'GET' && req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  return json(res, 404, { error:'Not found' });
});
server.listen(PORT, HOST, () => console.log(`TRUST NO ONE local WireGuard controller listening at http://${HOST}:${PORT}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
