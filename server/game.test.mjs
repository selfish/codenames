import test from 'node:test';
import assert from 'node:assert/strict';
import { Games } from './game.mjs';
import { createServer } from './http.mjs';
async function fixture(t, language = 'en') {
  let now = Date.now();
  const games = new Games({ now: () => now });
  const server = createServer({ games });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/rooms`;
  async function call(path, token, body) {
    const response = await fetch(url + path, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, ...await response.json() };
  }
  const a = await call('', null, { language, name: 'Host' });
  const code = a.state.code;
  const players = [a, ...await Promise.all([1,2,3].map(i => call(`/${code}/join`, null, { name: `Player ${i}` })))];
  const state = async i => (await call(`/${code}`, players[i].token)).state;
  const action = async (i, input, version) => call(`/${code}/action`, players[i].token, { version: version ?? (await state(i)).version, ...input });
  for (let i = 0; i < 4; i++) assert.equal((await action(i, { type: 'seat', team: i < 2 ? 'red' : 'blue', role: i % 2 ? 'operative' : 'spymaster' })).status, 200);
  assert.equal((await action(0, { type: 'start' })).status, 200);
  return { url, games, code, players, state, action, call, advance: ms => { now += ms; } };
}
for (const language of ['en','he']) test(`${language}: four concurrent clients, private key, role checks, races, reconnect and restart`, async t => {
  const f = await fixture(t, language);
  const states = await Promise.all([0,1,2,3].map(f.state));
  assert.equal(new Set(states.map(s => JSON.stringify(s.cards.map(c => c.word)))).size, 1);
  for (const i of [1,3]) {
    assert.ok(states[i].cards.every(c => !Object.hasOwn(c, 'role')));
    assert.ok(!JSON.stringify(states[i]).includes('token'));
    assert.ok(!Object.hasOwn(states[i], 'seed'));
  }
  assert.ok(states[0].cards.every(c => c.role));
  if (language === 'he') assert.ok(states[0].cards.every(c => /[א-ת]/.test(c.word)));
  assert.equal((await f.call(`/${f.code}`, 'wrong')).status, 401);
  const spy = states[0].turn === 'red' ? 0 : 2, op = spy + 1;
  assert.equal((await f.action(op, { type: 'seat', team: 'red', role: 'spymaster' })).status, 403);
  assert.equal((await f.action(op, { type: 'clue', clue: 'connections', count: 2 })).status, 403);
  assert.equal((await f.action(spy, { type: 'guess', index: 0 })).status, 403);
  assert.equal((await f.action(op, { type: 'guess', index: 0 })).status, 403);
  assert.equal((await f.action(spy, { type: 'clue', clue: 'connections', count: 2 })).status, 200);
  assert.equal((await f.action((op + 2) % 4, { type: 'end' })).status, 403);
  const current = await f.state(spy);
  const index = current.cards.findIndex(c => c.role === current.turn);
  const results = await Promise.all([f.action(op, { type: 'guess', index }, current.version), f.action(op, { type: 'guess', index }, current.version)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
  const refreshed = await f.state(op);
  assert.equal(refreshed.cards.filter(c => c.revealed).length, 1);
  assert.equal(refreshed.left, 2);
  assert.ok(refreshed.cards.filter(c => !c.revealed).every(c => !c.role));
  const guest = await f.call(`/${f.code}/join`, null, { name: 'Late guest' });
  assert.ok(guest.state.cards.filter(c => !c.revealed).every(c => !c.role));
  assert.equal((await f.call(`/${f.code}/action`, guest.token, { type: 'seat', team: 'blue', role: 'spymaster', version: guest.state.version })).status, 403);
  const assassin = current.cards.findIndex(c => c.role === 'assassin');
  assert.equal((await f.action(op, { type: 'guess', index: assassin })).state.winner, current.turn === 'red' ? 'blue' : 'red');
  assert.equal((await f.action(op, { type: 'end' })).status, 403);
  assert.equal((await f.action(0, { type: 'new' })).state.phase, 'lobby');
  const newLobby = await f.state(op); assert.deepEqual(newLobby.cards, []);
  await f.action(0, { type: 'start' });
  assert.notDeepEqual((await f.state(0)).cards, current.cards);
});
test('unlimited clues, wrong guesses, victory, role locks and host departure', async t => {
  const f = await fixture(t);
  let s = await f.state(0);
  const spy = s.turn === 'red' ? 0 : 2, op = spy + 1;
  for (const count of [0, '∞']) {
    await f.action(spy, { type: 'clue', clue: 'connections', count });
    assert.equal((await f.state(op)).left, null);
    await f.action(op, { type: 'end' });
    await f.action((spy + 2) % 4, { type: 'clue', clue: 'connections', count: 1 });
    const wrong = (await f.state(spy)).cards.findIndex(c => c.role === 'neutral' && !c.revealed);
    await f.action((op + 2) % 4, { type: 'guess', index: wrong });
    assert.equal((await f.state(op)).turn, s.turn);
  }
  await f.action(spy, { type: 'clue', clue: 'connections', count: '∞' });
  s = await f.state(spy);
  for (const [index, card] of s.cards.entries()) if (card.role === s.turn) await f.action(op, { type: 'guess', index });
  assert.equal((await f.state(op)).winner, s.turn);
  f.advance(31000);
  const successor = await f.state(1);
  assert.equal(successor.host, successor.me);
  assert.equal((await f.action(1, { type: 'new' })).state.phase, 'lobby');
  assert.equal((await f.state(0)).host, successor.me);
  assert.equal((await f.action(0, { type: 'remove', player: successor.me })).status, 403);
  const oldHost = (await f.state(0)).me;
  assert.equal((await f.action(1, { type: 'remove', player: oldHost })).status, 200);
  assert.equal((await f.call(`/${f.code}`, f.players[0].token)).status, 401);
  await f.action(1, { type: 'leave' });
  assert.notEqual((await f.state(2)).host, successor.me);
  f.advance(6 * 60 * 60 * 1000 + 1);
  assert.equal((await f.call(`/${f.code}`, f.players[0].token)).status, 404);
});
test('HTTP validation and origin boundary', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.url + '/' + f.code, { headers: { Origin: 'https://foreign.example', Authorization: 'Bearer ' + f.players[0].token } })).status, 403);
  assert.equal((await fetch(f.url.replace('/api/rooms','/server/words.json'))).status, 404);
  assert.equal((await fetch(f.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' })).status, 400);
  assert.equal((await f.call('', null, { language: 'zz', name: 'test' })).status, 400);
  assert.equal((await f.call(`/${f.code}/action`, f.players[0].token, { type: 'start', version: -1 })).status, 409);
  assert.equal((await f.call('/DEADBEEF00', f.players[0].token)).status, 404);
});

test('Node HTTP preserves split Hebrew UTF-8 and limits wire bytes', async t => {
  const { request } = await import('node:http');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = chunks => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path: '/api/rooms', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      const response = [];
      res.on('data', chunk => response.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, ...JSON.parse(Buffer.concat(response).toString('utf8')) }));
    });
    req.on('error', reject);
    let index = 0;
    const send = () => {
      if (index === chunks.length) { req.end(); return; }
      req.write(chunks[index++]);
      setTimeout(send, 5);
    };
    send();
  });
  const name = 'שלום עולם';
  const raw = Buffer.from(JSON.stringify({ language: 'he', name }));
  const start = raw.indexOf(Buffer.from('ש'));
  const result = await post([raw.subarray(0, start + 1), raw.subarray(start + 1, start + 3), raw.subarray(start + 3)]);
  assert.equal(result.status, 201);
  assert.equal(result.state.players[0].name, name);
  // Fewer than 4,096 JS characters, but more than 4,096 UTF-8 bytes.
  assert.equal((await post([Buffer.from(JSON.stringify({ language: 'he', name: 'א'.repeat(3000) }))])).status, 413);
  const input = { language: 'he', name, padding: '' };
  input.padding = 'x'.repeat(4096 - Buffer.byteLength(JSON.stringify(input)));
  const exact = Buffer.from(JSON.stringify(input));
  assert.equal(exact.length, 4096);
  assert.equal((await post([exact])).status, 201);
  assert.equal((await post([Buffer.concat([exact, Buffer.from(' ')])])).status, 413);
});
