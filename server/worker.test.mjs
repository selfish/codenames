import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import worker from './worker.mjs';
const execute = promisify(execFile);
import { SQLiteD1 } from '../scripts/sqlite-d1.mjs';
for (const language of ['en','he']) test(`persistent Worker ${language}: SQLite CAS races, privacy and fresh-instance recovery`, async t => {
  let now = 1730000000000;
  t.mock.method(Date, 'now', () => now);
  const dir = await mkdtemp(join(tmpdir(), 'remzilo-sql-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'rooms.sqlite');
  const migration = (await Promise.all((await readdir('server/migrations')).filter(n => n.endsWith('.sql')).sort().map(n => readFile(`server/migrations/${n}`, 'utf8')))).join('\n');
  await execute('python3', ['-c', 'import sqlite3,sys; sqlite3.connect(sys.argv[1]).executescript(sys.argv[2])', file, migration]);
  const call = async (path, token, body) => {
    // A fresh binding facade on every request models isolate/process replacement.
    const response = await worker.fetch(new Request(`https://preview.example/api/rooms${path}`, {
      method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(body ? { 'Content-Type':'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined
    }), { DB: new SQLiteD1(file) });
    return { status: response.status, ...await response.json() };
  };
  const creator = await call('', null, { name:'Host', language });
  assert.equal(creator.status, 201);
  const code = creator.state.code;
  const clients = [creator,...await Promise.all([1,2,3].map(i => call(`/${code}/join`,null,{name:`Player ${i}`})))];
  const state = async i => (await call(`/${code}`, clients[i].token)).state;
  const act = async (i,input,version) => call(`/${code}/action`,clients[i].token,{...input,version:version ?? (await state(i)).version});
  for (let i=0;i<4;i++) assert.equal((await act(i,{type:'seat',team:i<2?'red':'blue',role:i%2?'operative':'spymaster'})).status,200);
  await act(0,{type:'start'});
  const snapshots = await Promise.all([0,1,2,3].map(state));
  assert.equal(snapshots[0].players.length,4);
  for (const i of [1,3]) assert.ok(snapshots[i].cards.every(c => !c.role));
  const spy = snapshots[0].turn === 'red' ? 0 : 2, op = spy+1;
  await act(spy,{type:'clue',clue:'connections',count:2});
  const before = await state(spy);
  const index = before.cards.findIndex(c => c.role === before.turn);
  const results = await Promise.all([act(op,{type:'guess',index},before.version),act(op,{type:'guess',index},before.version),state(0),state(3)]);
  assert.deepEqual(results.slice(0,2).map(r => r.status).sort(),[200,409]);
  const restored = await state(op);
  assert.equal(restored.cards.filter(c => c.revealed).length,1);
  assert.equal(restored.left,2);
  assert.ok(restored.cards.filter(c => !c.revealed).every(c => !c.role));
  assert.equal((await act(op,{type:'seat',team:'red',role:'spymaster'})).status,403);
  assert.equal((await call(`/${code}`,'forged')).status,401);
  assert.equal((await worker.fetch(new Request(`https://preview.example/api/rooms/${code}`,{headers:{Origin:'https://evil.example'}}),{DB:new SQLiteD1(file)})).status,403);
  // Restart/deal from a fresh binding; no process memory holds the authoritative room.
  assert.equal((await act(0,{type:'new'})).state.phase,'lobby');
  await act(0,{type:'start'});
  assert.equal((await state(1)).cards.filter(c => c.revealed).length,0);
  const row = await new SQLiteD1(file).prepare('SELECT revision FROM rooms WHERE code = ?').bind(code).first();
  assert.ok(row.revision > restored.version);
  assert.equal((await call('', null, { name: 'a'.repeat(5000), language })).status, 413);
  await new SQLiteD1(file).prepare("UPDATE request_limits SET hits = 10 WHERE bucket LIKE 'create:%'").bind().run();
  assert.equal((await call('', null, { name: 'Excess', language })).status, 429);
  await new SQLiteD1(file).prepare("UPDATE request_limits SET hits = 60 WHERE bucket LIKE 'join:%'").bind().run();
  assert.equal((await call(`/${code}/join`, null, { name: 'Excess' })).status, 429);
  now += 60000;
  assert.equal((await call(`/${code}/join`, null, { name: 'New window' })).status, 200);
  const db = new SQLiteD1(file);
  await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 1005)
    INSERT INTO request_limits (bucket, window_start, hits) SELECT 'stale-' || x, 0, 1 FROM n`).bind().run();
  now += 180000;
  // Invalid requests still trigger housekeeping; no successful room creation.
  assert.equal((await call('', null, { name: 'a'.repeat(5000), language })).status, 413);
  const staleCount = async () => (await db.prepare("SELECT COUNT(*) AS count FROM request_limits WHERE bucket LIKE 'stale-%'").bind().first()).count;
  assert.equal(await staleCount(), 5); // Exactly the bounded 1,000-row batch.
  await call('/INVALID');
  assert.equal(await staleCount(), 5); // No second sweep in the same minute.
  now += 60000;
  await call('/INVALID');
  assert.equal(await staleCount(), 0);

});
