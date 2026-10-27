import { Games, Fault } from './game.mjs';

const TTL = 6 * 60 * 60 * 1000;
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const json = (status, value) => new Response(JSON.stringify(value), { status, headers });

// A storage revision tracks *every* write, separately from the public game revision.
// A heartbeat can never overwrite a simultaneous move, join, or host transfer.
export async function transact(db, code, operation) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await db.prepare('SELECT payload, revision FROM rooms WHERE code = ?').bind(code).first();
    if (!row) throw new Fault('roomMissing', 404);
    const room = JSON.parse(row.payload);
    if (Date.now() - room.touched > TTL) throw new Fault('roomMissing', 404);
    const games = new Games(); games.rooms.set(code, room);
    const result = operation(games);
    const update = await db.prepare('UPDATE rooms SET payload = ?, revision = revision + 1, touched = ? WHERE code = ? AND revision = ?')
      .bind(JSON.stringify(room), room.touched, code, row.revision).run();
    if (update.meta.changes === 1) return result;
  }
  throw new Fault('stale', 409);
}

async function cleanupQuotas(db) {
  const window = Math.floor(Date.now() / 60000);
  // One indexed singleton claim per minute, even when all requests are invalid.
  // Competing isolates cannot each run a sweep. Each sweep deletes <= 1,000 rows.
  const claimed = await db.prepare(`INSERT INTO request_limit_maintenance (id, next_window) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET next_window = excluded.next_window
    WHERE request_limit_maintenance.next_window <= ? RETURNING id`).bind(window + 1, window).first();
  if (claimed) await db.prepare(`DELETE FROM request_limits WHERE bucket IN (
    SELECT bucket FROM request_limits WHERE window_start < ? ORDER BY window_start LIMIT 1000
  )`).bind(window - 2).run();
}

async function limit(db, request, kind, maximum) {
  // Cloudflare supplies this header at the trusted edge. Other hosts must strip
  // visitor-supplied copies or provide their own trusted address adapter.
  const address = request.headers.get('CF-Connecting-IP') || 'local-shared';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  const hash = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,'0')).join('');
  const window = Math.floor(Date.now() / 60000);
  const allowed = await db.prepare(`INSERT INTO request_limits (bucket, window_start, hits) VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET
      hits = CASE WHEN request_limits.window_start = excluded.window_start THEN request_limits.hits + 1 ELSE 1 END,
      window_start = excluded.window_start
    WHERE request_limits.window_start != excluded.window_start OR request_limits.hits < ?
    RETURNING hits`).bind(`${kind}:${hash}`, window, maximum).first();
  if (!allowed) throw new Fault('rate', 429);
}

async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Fault('contentType', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new Fault('json');
  let bytes = 0;
  const chunks = [];
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    const { value } = chunk;
    bytes += value.byteLength;
    if (bytes > 4096) { await reader.cancel(); throw new Fault('tooLarge', 413); }
    chunks.push(value);
  }
  const raw = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
  let input;
  try { input = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new Fault('json'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Fault('json');
  return input;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(request.method)) throw new Fault('method', 405);
        const path = url.pathname === '/' ? '/index.html' : url.pathname;
        const asset = globalThis.REMZILO_ASSETS?.[path];
        if (!asset) throw new Fault('route', 404);
        return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.data), c => c.charCodeAt(0)), { headers: {
          ...headers, 'Content-Type': asset.type,
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'"
        } });
      }
      if (!env.DB) throw new Fault('storageUnavailable', 503);
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new Fault('origin', 403);
      await cleanupQuotas(env.DB);
      await limit(env.DB, request, 'all', 3600);
      if (request.method === 'POST' && url.pathname === '/api/rooms') await limit(env.DB, request, 'create', 10);
      if (request.method === 'POST' && url.pathname.endsWith('/join')) await limit(env.DB, request, 'join', 60);
      const body = request.method === 'POST' ? await readBody(request) : {};
      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM rooms WHERE touched < ?').bind(Date.now() - TTL).run();
        const games = new Games();
        const result = games.create(body.language, body.name);
        const room = games.rooms.get(result.state.code);
        const inserted = await env.DB.prepare('INSERT INTO rooms (code, payload, touched) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM rooms) < 200')
          .bind(room.code, JSON.stringify(room), room.touched).run();
        if (inserted.meta.changes !== 1) throw new Fault('capacity', 503);
        return json(201, result);
      }
      const match = /^\/api\/rooms\/([A-F0-9]{10})(?:\/(join|action))?$/.exec(url.pathname);
      if (!match) throw new Fault('route', 404);
      const [, code, operation] = match;
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (operation === 'join' && request.method === 'POST') return json(200, await transact(env.DB, code, games => games.join(code, body.name)));
      if (operation === 'action' && request.method === 'POST') return json(200, { state: await transact(env.DB, code, games => games.action(code, token, body)) });
      if (!operation && request.method === 'GET') return json(200, { state: await transact(env.DB, code, games => games.state(code, token)) });
      throw new Fault('method', 405);
    } catch (e) { return json(e instanceof Fault ? e.status : 500, { error: e instanceof Fault ? e.message : 'server' }); }
  }
};
