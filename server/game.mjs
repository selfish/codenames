import words from './words.mjs';
const randomBytes = size => ({ toString: () => [...crypto.getRandomValues(new Uint8Array(size))].map(v => v.toString(16).padStart(2, '0')).join('') });
const randomInt = max => {
  const limit = Math.floor(0x100000000 / max) * max;
  let value;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  return value % max;
};
const other = team => team === 'red' ? 'blue' : 'red';
const shuffled = values => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
export class Fault extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
const requireThat = (condition, code, status) => { if (!condition) throw new Fault(code, status); };
export class Games {
  constructor({ now = Date.now } = {}) { this.rooms = new Map(); this.now = now; }
  sweep() {
    for (const [code, room] of this.rooms) if (this.now() - room.touched > 6 * 60 * 60 * 1000) this.rooms.delete(code);
  }
  create(language, name) {
    this.sweep();
    requireThat(this.rooms.size < 200, 'capacity', 503);
    requireThat(language === 'he' || language === 'en', 'language');
    let code;
    do { code = randomBytes(5).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const room = { code, language, version: 0, phase: 'lobby', players: [], cards: [], touched: this.now(), host: null };
    const joined = this.add(room, name);
    this.rooms.set(code, room);
    return joined;
  }
  room(code) { this.sweep(); const room = this.rooms.get(code); requireThat(room, 'roomMissing', 404); return room; }
  add(room, name) {
    requireThat(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 24, 'name');
    requireThat(room.players.length < 24, 'full', 409);
    const player = { id: randomBytes(8).toString('hex'), token: randomBytes(32).toString('hex'), name: name.trim(), team: null, role: 'operative', seen: this.now() };
    room.players.push(player);
    room.host ||= player.id;
    room.version++;
    room.touched = this.now();
    return { token: player.token, state: this.view(room, player) };
  }
  join(code, name) { return this.add(this.room(code), name); }
  auth(code, token) {
    const room = this.room(code);
    const player = room.players.find(p => p.token === token);
    requireThat(player, 'unauthorized', 401);
    player.seen = this.now(); room.touched = this.now();
    const host = room.players.find(p => p.id === room.host);
    if (!host || this.now() - host.seen > 30000) {
      room.host = room.players.filter(p => this.now() - p.seen <= 30000).sort((a,b) => a.id.localeCompare(b.id))[0].id;
      room.version++;
    }
    return { room, player };
  }
  view(room, player) {
    return {
      code: room.code, language: room.language, version: room.version, phase: room.phase, host: room.host, me: player.id,
      players: room.players.map(({ id, name, team, role, seen }) => ({ id, name, team, role, online: this.now() - seen <= 30000 })),
      cards: room.cards.map(({ word, role, revealed }) => ({ word, revealed, ...(revealed || player.role === 'spymaster' ? { role } : {}) })),
      turn: room.turn, clue: room.clue, left: room.left, winner: room.winner,
      remaining: Object.fromEntries(['red', 'blue'].map(team => [team, room.cards.filter(c => c.role === team && !c.revealed).length]))
    };
  }
  state(code, token) { const { room, player } = this.auth(code, token); return this.view(room, player); }
  action(code, token, input) {
    const { room: r, player: p } = this.auth(code, token);
    requireThat(input.version === r.version, 'stale', 409);
    const { type } = input;
    if (type === 'seat') {
      requireThat(r.phase === 'lobby', 'locked', 403);
      requireThat(['red', 'blue'].includes(input.team) && ['operative', 'spymaster'].includes(input.role), 'seat');
      requireThat(input.role !== 'spymaster' || !r.players.some(q => q.id !== p.id && q.team === input.team && q.role === 'spymaster'), 'occupied', 409);
      p.team = input.team; p.role = input.role;
    } else if (type === 'remove') {
      requireThat(p.id === r.host && r.phase === 'lobby' && input.player !== p.id, 'forbidden', 403);
      requireThat(r.players.some(q => q.id === input.player), 'player');
      r.players = r.players.filter(q => q.id !== input.player);
    } else if (type === 'start') {
      requireThat(p.id === r.host && r.phase === 'lobby', 'forbidden', 403);
      requireThat(['red','blue'].every(team => ['operative','spymaster'].every(role => r.players.some(q => q.team === team && q.role === role && this.now() - q.seen <= 30000))), 'needFour');
      r.turn = randomInt(2) ? 'red' : 'blue';
      const roles = shuffled([...Array(9).fill(r.turn), ...Array(8).fill(other(r.turn)), ...Array(7).fill('neutral'), 'assassin']);
      r.cards = shuffled(words[r.language]).slice(0,25).map((word,i) => ({ word, role: roles[i], revealed: false }));
      r.phase = 'clue'; r.clue = null; r.left = null; r.winner = null;
    } else if (type === 'new') {
      requireThat(p.id === r.host && r.phase !== 'lobby', 'forbidden', 403);
      r.phase = 'lobby'; r.cards = []; r.clue = null; r.turn = null; r.left = null; r.winner = null;
      // No key exists while players may change roles in the new lobby.
    } else if (type === 'leave') {
      // A spymaster cannot re-seat as an operative in the same game.
      r.players = r.players.filter(q => q !== p);
      if (r.host === p.id) r.host = r.players[0]?.id || null;
    } else if (type === 'clue') {
      requireThat(r.phase === 'clue' && p.team === r.turn && p.role === 'spymaster', 'forbidden', 403);
      requireThat(typeof input.clue === 'string' && /^[\p{L}\p{M}-]{1,40}$/u.test(input.clue) && !r.cards.some(c => !c.revealed && c.word.toLocaleLowerCase() === input.clue.toLocaleLowerCase()), 'clue');
      requireThat(input.count === '∞' || (Number.isInteger(input.count) && input.count >= 0 && input.count <= 9), 'count');
      r.clue = { word: input.clue, count: input.count };
      r.left = input.count === 0 || input.count === '∞' ? null : input.count + 1;
      r.phase = 'guess';
    } else if (type === 'guess' || type === 'end') {
      requireThat(r.phase === 'guess' && p.team === r.turn && p.role === 'operative', 'forbidden', 403);
      if (type === 'end') { this.end(r); }
      else {
        requireThat(Number.isInteger(input.index) && input.index >= 0 && input.index < 25 && !r.cards[input.index].revealed, 'card');
        const card = r.cards[input.index]; card.revealed = true;
        if (card.role === 'assassin') r.winner = other(r.turn);
        else if (['red','blue'].includes(card.role) && !r.cards.some(c => c.role === card.role && !c.revealed)) r.winner = card.role;
        if (r.winner) r.phase = 'over';
        else {
          if (r.left !== null) r.left--;
          if (card.role !== r.turn || r.left === 0) this.end(r);
        }
      }
    } else throw new Fault('action');
    r.version++; r.touched = this.now();
    return this.view(r, p);
  }
  end(r) { r.turn = other(r.turn); r.phase = 'clue'; r.clue = null; r.left = null; }
}
