import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Games, Fault } from './game.mjs';
export function createServer({ games = new Games(), build = resolve('build') } = {}) {
  const rates = new Map();
  const server = http.createServer(async (req, res) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    const json = (status, data) => { res.writeHead(status, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        // Tokens are sent only in Authorization, never URLs, cookies or logs.
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) throw new Fault('origin', 403);
        const address = req.socket.remoteAddress;
        const now = Date.now();
        if (rates.size > 10000) for (const [key, value] of rates) if (now - value.start > 60000) rates.delete(key);
        let rate = rates.get(address);
        if (!rate || now - rate.start > 60000) { rate = { start: now, count: 0, creates: 0, joins: 0 }; rates.set(address, rate); }
        if (++rate.count > 3600) throw new Fault('rate', 429);
        if (req.method === 'POST' && url.pathname === '/api/rooms' && ++rate.creates > 10) throw new Fault('rate', 429);
        if (req.method === 'POST' && url.pathname.endsWith('/join') && ++rate.joins > 60) throw new Fault('rate', 429);
        let body = {};
        if (req.method === 'POST') {
          if (!req.headers['content-type']?.startsWith('application/json')) throw new Fault('contentType', 415);
          const chunks = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 4096) throw new Fault('tooLarge', 413);
            chunks.push(chunk);
          }
          // A TCP/HTTP chunk may end inside a Hebrew UTF-8 character.
          // Decode once, after enforcing the wire-byte limit.
          try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes))); }
          catch { throw new Fault('json'); }
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Fault('json');
        }
        if (url.pathname === '/api/rooms' && req.method === 'POST') return json(201, games.create(body.language, body.name));
        const match = /^\/api\/rooms\/([A-F0-9]{10})(?:\/(join|action))?$/.exec(url.pathname);
        if (!match) throw new Fault('route', 404);
        const [, code, operation] = match;
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        if (operation === 'join' && req.method === 'POST') return json(200, games.join(code, body.name));
        if (operation === 'action' && req.method === 'POST') return json(200, { state: games.action(code, token, body) });
        if (!operation && req.method === 'GET') return json(200, { state: games.state(code, token) });
        throw new Fault('method', 405);
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new Fault('method', 405);
      const relative = decodeURIComponent(url.pathname);
      const file = resolve(build, '.' + (relative === '/' ? '/index.html' : relative));
      if (!file.startsWith(build + '/')) throw new Fault('route', 404);
      let data;
      try { data = await readFile(file); } catch { throw new Fault('route', 404); }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
      res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'" });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { json(error instanceof Fault ? error.status : 500, { error: error instanceof Fault ? error.message : 'server' }); }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  createServer().listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Remzilo listening on port ${port}`));
}
