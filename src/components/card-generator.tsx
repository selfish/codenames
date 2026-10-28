import React, { useEffect, useRef, useState } from 'react';
import words from '../data/words.mjs';
import './online-game.css';
import './card-generator.css';
export type Language = 'en' | 'he';
type Role = 'red' | 'blue' | 'neutral' | 'black';
type Deal = { starting: 'red' | 'blue'; roles: Role[]; words: string[] };
const text = {
  en: { title: 'Remzilo', heading: 'Card generator', online: 'Online rooms', mode: 'Play mode', local: 'For in-person play. No room, account or internet connection needed after this page loads.', key: 'Key card', words: 'Word cards', randomize: 'Randomize', busy: 'Shuffling…', empty: 'Randomize to generate a card.', red: 'Red', blue: 'Blue', neutral: 'Neutral', black: 'Blackout', starts: 'starts', warning: 'Keep the key private. This local card is separate from every online room.', grid: 'Generated card', row: 'Row', column: 'column', change: 'Changing language starts a fresh card. Switching views keeps the same card.' },
  he: { title: 'רמזילו', heading: 'מחולל כרטיסים', online: 'משחק אונליין', mode: 'מצב משחק', local: 'למשחק פנים אל פנים. אין צורך בחדר, בחשבון או בחיבור לאינטרנט לאחר טעינת הדף.', key: 'כרטיס מפתח', words: 'כרטיסי מילים', randomize: 'ערבוב מחדש', busy: 'מערבבים…', empty: 'ערבבו כדי ליצור כרטיס.', red: 'אדום', blue: 'כחול', neutral: 'ניטרלי', black: 'ניתוק', starts: 'מתחיל', warning: 'שמרו את המפתח בסוד. הכרטיס המקומי נפרד מכל חדר אונליין.', grid: 'כרטיס שנוצר', row: 'שורה', column: 'עמודה', change: 'שינוי השפה מתחיל כרטיס חדש. מעבר בין התצוגות שומר על אותו כרטיס.' }
};
const colors = { red: '#dc4347', blue: '#3c83b1', neutral: '#e6dfa7', black: '#111111' };
function shuffle<T,>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function generate(language: Language): Deal {
  const starting = Math.random() < 0.5 ? 'red' : 'blue';
  const other = starting === 'red' ? 'blue' : 'red';
  return { starting, roles: shuffle<Role>([...Array(9).fill(starting), ...Array(8).fill(other), ...Array(7).fill('neutral'), 'black']), words: shuffle(words[language]).slice(0, 25) };
}
export default function CardGenerator({ onOnline }: { onOnline: (language: Language) => void }) {
  const [language, setLanguage] = useState<Language>(() => new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'he');
  const [view, setView] = useState('key');
  const [deal, setDeal] = useState<Deal | null>(null);
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState<Role[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generating = useRef(false);
  const t = text[language];
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url);
  }, [language]);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  function randomize() {
    if (generating.current) return;
    generating.current = true;
    setBusy(true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finish = () => { generating.current = false; setBusy(false); setFrame(null); };
    if (reduced) { setDeal(generate(language)); finish(); return; }
    let step = 0;
    const animate = () => {
      if (step < 6) {
        setFrame(generate(language).roles);
        step++;
        timer.current = setTimeout(animate, 300);
      } else {
        setDeal(generate(language));
        setFrame(null);
        timer.current = setTimeout(finish, 500);
      }
    };
    animate();
  }
  const roles = frame || deal?.roles;
  return <main className="game-shell online cards-only" dir={language === 'he' ? 'rtl' : 'ltr'}>
    <header className="online-header"><h1><span className="brand-mark" aria-hidden="true">⌁</span> {t.title}</h1><select aria-label="Language / שפה" value={language} disabled={busy} onChange={e => { setLanguage(e.target.value as Language); setDeal(null); }}><option value="he">עברית</option><option value="en">English</option></select></header>
    <nav className="mode-navigation" aria-label={t.mode}><strong>{t.heading}</strong><button onClick={() => onOnline(language)}>{t.online}</button></nav>
    <p>{t.local}</p>
    <div className="card-views" role="group" aria-label={t.heading}><button aria-pressed={view === 'key'} onClick={() => setView('key')}>{t.key}</button><button aria-pressed={view === 'words'} onClick={() => setView('words')}>{t.words}</button></div>
    <p className="card-status" role="status">{busy ? t.busy : deal ? `${t[deal.starting]} ${t.starts}` : t.empty}</p>
    <div className="key-frame" style={{ borderColor: deal && !busy ? colors[deal.starting] : '#334155' }}>
      {['top', 'bottom', 'left', 'right'].map(side => <span key={side} className={`starting-marker marker-${side}`} aria-hidden="true" style={{ backgroundColor: deal && !busy ? colors[deal.starting] : '#111111' }} />)}
      <div className="generator-grid" role="group" aria-label={t.grid} aria-busy={busy} dir="ltr">
        {Array.from({ length: 25 }, (_, i) => {
          const role = roles?.[i];
          const label = `${t.row} ${Math.floor(i / 5) + 1}, ${t.column} ${i % 5 + 1}`;
          return <div key={i} className={`generator-cell ${view === 'words' ? 'word-cell' : 'key-cell'}`} data-role={!busy && view === 'key' && deal ? deal.roles[i] : undefined} aria-label={!busy && deal ? `${label}: ${view === 'key' ? t[deal.roles[i]] : deal.words[i]}` : label} style={{ backgroundColor: view === 'key' ? role ? colors[role] : i % 2 ? colors.red : colors.blue : '#fffdf6' }}>
            <span aria-hidden="true" dir="auto">{!busy && deal ? view === 'words' ? deal.words[i] : ({ red: '●', blue: '◆', neutral: '○', black: '×' }[deal.roles[i]]) : ''}</span>
          </div>;
        })}
      </div>
    </div>
    <button className="randomize-card" disabled={busy} onClick={randomize}>{busy ? t.busy : t.randomize}</button>
    {view === 'key' && <p className="key-legend">● {t.red} · ◆ {t.blue} · ○ {t.neutral} · × {t.black}</p>}
    <p className="muted">{t.warning}</p><p className="muted">{t.change}</p>
  </main>;
}
