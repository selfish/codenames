import React, { useEffect, useRef, useState } from 'react';
import './online-game.css';
type Team = 'red' | 'blue';
type Language = 'en' | 'he';
type Role = Team | 'neutral' | 'assassin';
type Player = { id: string; name: string; team: Team | null; role: 'operative' | 'spymaster'; online: boolean };
type State = { code: string; language: Language; version: number; phase: string; host: string; me: string; players: Player[]; cards: { word: string; role?: Role; revealed: boolean }[]; turn?: Team; clue?: { word: string; count: number | string }; left: number | null; winner?: Team; remaining: Record<Team, number> };
type Session = { code: string; token: string };
const copy = {
  en: { title: 'Remzilo', subtitle: 'Follow a hint. Find a connection.', name: 'Your name', code: 'Room code', create: 'Create room', join: 'Join room', share: 'Copy room link', copied: 'Link copied', lobby: 'Choose your team and role', red: 'Red', blue: 'Blue', neutral: 'Bystander', assassin: 'Blackout', operative: 'Finder', spymaster: 'Clue guide', start: 'Start game', need: 'At least 4 players: a clue guide and finder on each team.', waiting: 'Waiting for the host to start', clue: 'Clue', count: 'Count', example: 'e.g. ocean', give: 'Give clue', end: 'End turn', turn: 'Turn', left: 'Guesses left', won: 'wins!', new: 'New game', confirm: 'End this game and return everyone to the lobby?', leave: 'Leave room', reconnect: 'Reconnecting… actions paused', connected: 'Connected', loading: 'Connecting…', error: 'Unable to complete action. Try again.', stale: 'The game changed. Review the board and try again.', forbidden: 'This action is not allowed for your role or turn.', invalid: 'Check your input. Use one word for a clue, not an unrevealed board word.', missing: 'Room expired or server restarted. Create or join a room.', spectator: 'Spectator — join a team in the next lobby', secret: 'Secret key — keep your screen private', waitClue: 'Waiting for your clue guide', waitGuess: 'Operatives are guessing', host: 'Host', offline: 'Offline', back: 'Back', room: 'Room', occupied: 'That spymaster seat is taken.', note: 'Rooms expire after 6 idle hours or a server restart. Keep this browser to reconnect. Anyone with the link may join; choose clue guides before starting.', remove: 'Remove', players: 'Players', how: 'How to play', rules: 'Split into red and blue. Each guide sees the hidden colors and gives one word plus a number. Finders tap related words: their color keeps the turn going, another color ends it, and Blackout loses the round. Find every word in your color to win. A number permits one extra guess; 0 and ∞ allow any number. Agree together which word connections are fair.', unavailable: 'The multiplayer server is unavailable. This game needs the Node server, not static hosting.' },
  he: { title: 'רמזילו', subtitle: 'רמז קטן. חיבור גדול.', name: 'השם שלך', code: 'קוד חדר', create: 'יצירת חדר', join: 'הצטרפות לחדר', share: 'העתקת קישור לחדר', copied: 'הקישור הועתק', lobby: 'בחרו קבוצה ותפקיד', red: 'אדום', blue: 'כחול', neutral: 'אזרח', assassin: 'ניתוק', operative: 'מנחש/ת', spymaster: 'מדריך/ת רמזים', start: 'התחלת משחק', need: 'צריך לפחות 4 שחקנים: מדריך רמזים ומנחש בכל קבוצה.', waiting: 'ממתינים למארח להתחלת המשחק', clue: 'רמז', count: 'מספר', example: 'למשל: ים', give: 'שליחת רמז', end: 'סיום תור', turn: 'תור', left: 'ניחושים שנותרו', won: 'ניצחה!', new: 'משחק חדש', confirm: 'לסיים את המשחק ולהחזיר את כולם ללובי?', leave: 'עזיבת החדר', reconnect: 'מתחברים מחדש… הפעולות מושהות', connected: 'מחובר', loading: 'מתחברים…', error: 'הפעולה לא הושלמה. נסו שוב.', stale: 'המשחק השתנה. בדקו את הלוח ונסו שוב.', forbidden: 'הפעולה אינה מותרת לתפקיד או לתור שלך.', invalid: 'בדקו את הקלט. הרמז צריך להיות מילה אחת שאינה מילה גלויה בלוח.', missing: 'החדר פג או שהשרת הופעל מחדש. צרו חדר או הצטרפו לחדר אחר.', spectator: 'צופה — אפשר לבחור קבוצה בלובי הבא', secret: 'מפתח סודי — אל תחשפו את המסך', waitClue: 'ממתינים לרמז ממדריך הרמזים', waitGuess: 'המנחשים בוחרים מילים', host: 'מארח', offline: 'לא מחובר', back: 'חזרה', room: 'חדר', occupied: 'תפקיד מדריך הרמזים בקבוצה כבר תפוס.', note: 'החדר נשמר עד 6 שעות ללא פעילות או עד הפעלה מחדש של השרת. חזרו מאותו דפדפן כדי להתחבר מחדש. כל מי שמחזיק בקישור יכול להצטרף; בחרו מדריך רמזים לפני ההתחלה.', remove: 'הסרה', players: 'שחקנים', how: 'איך משחקים', rules: 'מתחלקים לאדום ולכחול. מדריכי הרמזים רואים את הצבעים הנסתרים ונותנים מילה ומספר. המנחשים בוחרים מילים קשורות: הצבע שלהם ממשיך את התור, צבע אחר מסיים אותו, וניתוק גורם להפסד. מצאו את כל המילים בצבע שלכם כדי לנצח. המספר מאפשר ניחוש נוסף אחד; 0 ו־∞ מאפשרים מספר ניחושים ללא הגבלה. החליטו יחד אילו קשרים בין מילים הוגנים.', unavailable: 'שרת המשחק אינו זמין. המשחק דורש שרת Node ולא אחסון סטטי.' }
};
function initialSession(): Session | null {
  try { const code = new URLSearchParams(location.search).get('room'); const token = code && localStorage.getItem(`room:${code}`); return code && token ? { code, token } : null; } catch { return null; }
}
async function request(path: string, token?: string, body?: object) {
  const response = await fetch(`/api/rooms${path}`, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  let result;
  try { result = await response.json(); } catch { throw new Error('unavailable'); }
  if (!response.ok) throw new Error(result.error || 'error');
  return result;
}
export default function OnlineGame() {
  const [language, setLanguage] = useState<Language>('he');
  const [session, setSession] = useState<Session | null>(initialSession);
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [clue, setClue] = useState('');
  const [count, setCount] = useState('1');
  const [copied, setCopied] = useState(false);
  const generation = useRef(0);
  const t = copy[state?.language || language];
  const accept = (next: State) => setState(old => !old || old.code !== next.code || next.version >= old.version ? next : old);
  useEffect(() => {
    document.documentElement.lang = state?.language || language;
    document.documentElement.dir = (state?.language || language) === 'he' ? 'rtl' : 'ltr';
  }, [language, state?.language]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await request(`/${session!.code}`, session!.token);
        if (active) { accept(result.state); setConnected(true); }
      } catch (e) { if (active) { setConnected(false); if (e instanceof Error && ['roomMissing','unauthorized'].includes(e.message)) setError('missing'); } }
      if (active) timer = setTimeout(poll, 1000);
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [session]);
  function describe(e: unknown) {
    const key = e instanceof Error ? e.message : 'error';
    return ['stale','forbidden','occupied','unavailable'].includes(key) ? key : ['roomMissing','unauthorized'].includes(key) ? 'missing' : ['clue','count','name','seat','language'].includes(key) ? 'invalid' : key === 'needFour' ? 'need' : 'error';
  }
  async function enter(create: boolean) {
    setBusy(true); setError('');
    try {
      const result = await request(create ? '' : `/${code.toUpperCase()}/join`, undefined, create ? { name, language } : { name });
      const next = { code: result.state.code, token: result.token };
      try { localStorage.setItem(`room:${next.code}`, next.token); } catch { /* Session remains usable until reload. */ }
      const url = new URL(location.href); url.search = ''; url.searchParams.set('room', next.code); history.replaceState(null,'',url);
      setState(result.state); setSession(next); setConnected(true);
    } catch (e) { setError(describe(e)); } finally { setBusy(false); }
  }
  async function act(input: object) {
    if (!session || !state || busy || !connected) return;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const result = await request(`/${session.code}/action`, session.token, { ...input, version: state.version });
      if (current === generation.current) { accept(result.state); setClue(''); }
    } catch (e) { if (current === generation.current) setError(describe(e)); }
    finally { if (current === generation.current) setBusy(false); }
  }
  function back() {
    generation.current++; setSession(null); setState(null); setConnected(false); setError(''); setBusy(false);
    history.replaceState(null, '', location.pathname);
  }
  async function leave() {
    if (session && state && connected) {
      try { await request(`/${session.code}/action`, session.token, { type: 'leave', version: state.version }); }
      catch (e) { setError(describe(e)); return; }
      try { localStorage.removeItem(`room:${session.code}`); } catch { /* optional storage */ }
    }
    back();
  }
  const me = state?.players.find(p => p.id === state.me);
  const active = me?.team === state?.turn;
  const canGuess = state?.phase === 'guess' && active && me?.role === 'operative';
  const ready = state && ['red','blue'].every(team => ['operative','spymaster'].every(role => state.players.some(p => p.team === team && p.role === role && p.online)));
  const disabled = busy || !connected;
  return <main className={`game-shell online ${state && state.phase !== 'lobby' ? 'playing' : ''}`} dir={(state?.language || language) === 'he' ? 'rtl' : 'ltr'}>
    <header className="online-header"><div><h1><span className="brand-mark" aria-hidden="true">⌁</span> {t.title}</h1><p>{t.subtitle}</p></div>{!session && <select aria-label="Language / שפה" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="he">עברית</option><option value="en">English</option></select>}</header>
    <details className="how-to"><summary>{t.how}</summary><p>{t.rules}</p></details>
    {error && <p role="alert">{t[error as keyof typeof t] || t.error}</p>}
    {!session ? <section className="entry panel">
      <label>{t.name}<input autoComplete="nickname" maxLength={24} value={name} onChange={e => setName(e.target.value)} /></label>
      <button disabled={busy || !name.trim()} onClick={() => enter(true)}>{t.create}</button>
      <label>{t.code}<input dir="ltr" maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))} /></label>
      <button disabled={busy || !name.trim() || code.length !== 10} onClick={() => enter(false)}>{t.join}</button>
      <p className="muted">{t.note}</p>
    </section> : !state ? <section><p>{t.loading}</p><button onClick={back}>{t.back}</button></section> : <>
      <nav className="room-bar"><strong>{t.room} <bdi>{state.code}</bdi></strong><span role="status">{connected ? t.connected : t.reconnect}</span><button onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { setCopied(false); } }}>{copied ? t.copied : t.share}</button><button disabled={busy} onClick={leave}>{t.leave}</button></nav>
      <section className="teams">{(['red','blue'] as Team[]).map(team => <div className={`panel team-${team}`} key={team}>
        <h2>{t[team]} {state.phase !== 'lobby' && <span>{state.remaining[team]}</span>}</h2>
        <details open={state.phase === 'lobby'}><summary>{t.players}</summary><ul>{state.players.filter(p => p.team === team).map(p => <li key={p.id}>{p.name} · {t[p.role]} {p.id === state.host && `· ${t.host}`} {!p.online && `· ${t.offline}`} {state.phase === 'lobby' && state.me === state.host && p.id !== state.me && <button className="remove-player" disabled={disabled} aria-label={`${t.remove}: ${p.name}`} onClick={() => act({ type: 'remove', player: p.id })}>{t.remove}</button>}</li>)}</ul></details>
        {state.phase === 'lobby' && <div className="seat-buttons">{(['operative','spymaster'] as const).map(role => <button key={role} aria-pressed={me?.team === team && me.role === role} disabled={disabled || (role === 'spymaster' && state.players.some(p => p.id !== state.me && p.team === team && p.role === role))} onClick={() => act({ type: 'seat', team, role })}>{t[role]}</button>)}</div>}
      </div>)}</section>
      {state.phase === 'lobby' ? <section className="panel lobby"><h2>{t.lobby}</h2><p>{t.need}</p><p>{state.players.filter(p => !p.team).map(p => p.name).join(' · ')}</p>{state.me === state.host ? <button disabled={disabled || !ready} onClick={() => act({ type: 'start' })}>{t.start}</button> : <p>{t.waiting}</p>}</section> : <>
        <section className="turn-panel panel" aria-live="polite"><h2>{state.winner ? `${t[state.winner]} ${t.won}` : `${t.turn}: ${state.turn ? t[state.turn] : ''}`}</h2>
          <p>{me?.role === 'spymaster' ? t.secret : !me?.team ? t.spectator : t.operative}</p>
          {state.clue ? <p className="current-clue">{state.clue.word} · {state.clue.count} — {t.left}: {state.left ?? '∞'}</p> : <p>{t.waitClue}</p>}
          {state.phase === 'clue' && active && me?.role === 'spymaster' && <form onSubmit={e => { e.preventDefault(); act({ type: 'clue', clue: clue.trim(), count: count === '∞' ? count : Number(count) }); }}><label>{t.clue}<input value={clue} placeholder={t.example} maxLength={40} onChange={e => setClue(e.target.value)} /></label><label>{t.count}<select aria-label={t.count} value={count} onChange={e => setCount(e.target.value)}>{['0','1','2','3','4','5','6','7','8','9','∞'].map(n => <option key={n}>{n}</option>)}</select></label><button disabled={disabled || !clue.trim()}>{t.give}</button></form>}
          {canGuess && <button disabled={disabled} onClick={() => act({ type: 'end' })}>{t.end}</button>}
        </section>
        <div className="online-board" aria-label={t.title}>{state.cards.map((card, i) => <button key={i} className={`online-card ${card.role || 'hidden'} ${card.revealed ? 'revealed' : ''}`} disabled={disabled || !canGuess || card.revealed} onClick={() => act({ type: 'guess', index: i })} aria-label={`${card.word}${card.role ? ` · ${t[card.role]}` : ''}${card.revealed ? ' ✓' : ''}`}><span>{card.word}</span><small>{card.role ? t[card.role] : '•'}{card.revealed && ' ✓'}</small></button>)}</div>
        {state.me === state.host && <button className="new-game" disabled={disabled} onClick={() => { if (window.confirm(t.confirm)) act({ type: 'new' }); }}>{t.new}</button>}
      </>}
    </>}
  </main>;
}
