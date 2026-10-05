import React, { useEffect, useMemo, useState } from 'react';

type Team = 'red' | 'blue';
type Role = Team | 'neutral' | 'assassin';

type Card = {
  word: string;
  role: Role;
  revealed: boolean;
};

const WORDS = [
  'ANCHOR', 'APPLE', 'ATLANTIS', 'BAND', 'BANK', 'BARK', 'BAT', 'BEACH', 'BEAR', 'BEAT',
  'BELT', 'BERLIN', 'BOARD', 'BOLT', 'BOND', 'BOOM', 'BOOT', 'BRIDGE', 'BRUSH', 'BUCK',
  'BUFFALO', 'BUG', 'CAP', 'CAPITAL', 'CARD', 'CAST', 'CENTER', 'CHARGE', 'CHECK', 'CHEST',
  'CHINA', 'CHIP', 'CLIFF', 'CLOAK', 'CLUB', 'CODE', 'COMIC', 'COMPOUND', 'CONCERT', 'COPPER',
  'CRANE', 'CRASH', 'CRICKET', 'CROWN', 'CYCLE', 'DECK', 'DIAMOND', 'DICE', 'DINOSAUR', 'DOCTOR',
  'DRAGON', 'DRESS', 'DRILL', 'DROP', 'DUCK', 'ENGINE', 'EUROPE', 'FALL', 'FAN', 'FIELD',
  'FIGHTER', 'FIGURE', 'FILE', 'FISH', 'FLUTE', 'FLY', 'FOREST', 'FORK', 'FRANCE', 'GAME',
  'GAS', 'GHOST', 'GIANT', 'GLASS', 'GLOVE', 'GOLD', 'GRACE', 'GRASS', 'GREEN', 'GROUND',
  'HAM', 'HAWK', 'HEAD', 'HEART', 'HELICOPTER', 'HIMALAYAS', 'HOLE', 'HOOD', 'HOOK', 'HORN',
  'HORSE', 'HOSPITAL', 'HOTEL', 'ICE', 'INDIA', 'IRON', 'IVORY', 'JACK', 'JET', 'JUPITER',
  'KANGAROO', 'KETCHUP', 'KEY', 'KING', 'KIWI', 'KNIGHT', 'LAB', 'LAP', 'LASER', 'LAWYER',
  'LEAD', 'LEMON', 'LIMOUSINE', 'LINE', 'LINK', 'LION', 'LITTER', 'LOCH NESS', 'LOCK', 'LOG',
  'LONDON', 'LUCK', 'MAIL', 'MAMMOTH', 'MAPLE', 'MARCH', 'MASS', 'MATCH', 'MERCURY', 'MILLIONAIRE',
  'MINE', 'MINT', 'MISSILE', 'MODEL', 'MOLE', 'MOON', 'MOSCOW', 'MOUNT', 'MOUSE', 'MUG',
  'NAIL', 'NEEDLE', 'NET', 'NIGHT', 'NINJA', 'NOTE', 'NOVEL', 'NURSE', 'OCTOPUS', 'OIL',
  'OLIVE', 'OPERA', 'ORANGE', 'ORGAN', 'PALM', 'PAN', 'PANTS', 'PAPER', 'PARACHUTE', 'PARK',
  'PART', 'PASS', 'PASTE', 'PENGUIN', 'PHOENIX', 'PIANO', 'PIE', 'PILOT', 'PIN', 'PIPE',
  'PIRATE', 'PISTOL', 'PITCH', 'PLANE', 'PLATE', 'PLOT', 'POINT', 'POLE', 'PORT', 'POST',
  'PRESS', 'PRINCESS', 'PUMPKIN', 'PUPIL', 'PYRAMID', 'QUEEN', 'RABBIT', 'RAY', 'REVOLUTION', 'RING',
  'ROBIN', 'ROBOT', 'ROCK', 'ROME', 'ROOT', 'ROSE', 'ROULETTE', 'ROUND', 'ROW', 'RULER',
  'SATELLITE', 'SATURN', 'SCALE', 'SCHOOL', 'SCIENTIST', 'SCORPION', 'SCREEN', 'SERVER', 'SHADOW', 'SHAKESPEARE',
  'SHARK', 'SHIP', 'SHOE', 'SHOP', 'SHOT', 'SINK', 'SKYSCRAPER', 'SLIP', 'SLUG', 'SMUGGLER',
  'SNOW', 'SNOWMAN', 'SOCK', 'SOLDIER', 'SOUL', 'SPACE', 'SPELL', 'SPIDER', 'SPIKE', 'SPRING',
  'SPY', 'SQUARE', 'STADIUM', 'STAFF', 'STAR', 'STATE', 'STICK', 'STOCK', 'STRAW', 'STREAM',
  'STRIKE', 'STRING', 'SUB', 'SUIT', 'SWING', 'SWITCH', 'TABLE', 'TABLET', 'TAG', 'TAIL',
  'TAP', 'TEACHER', 'TELESCOPE', 'TEMPLE', 'THEATER', 'THIEF', 'THUMB', 'TICK', 'TIE', 'TIME',
  'TOKYO', 'TOOTH', 'TORCH', 'TOWER', 'TRACK', 'TRAIN', 'TRIANGLE', 'TRIP', 'TRUNK', 'TUBE',
  'TURKEY', 'UNDERTAKER', 'UNICORN', 'VACUUM', 'VAN', 'VET', 'WAKE', 'WALL', 'WAR', 'WASHER',
  'WATER', 'WAVE', 'WEB', 'WELL', 'WHALE', 'WHIP', 'WIND', 'WITCH', 'YARD', 'ZEUS'
];

const roleLabel: Record<Role, string> = {
  red: 'Red agent',
  blue: 'Blue agent',
  neutral: 'Bystander',
  assassin: 'Assassin'
};

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed: number) {
  return () => {
    seed += 0x6D2B79F5;
    let result = seed;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: T[], random: () => number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function makeGame(seed: string): { cards: Card[]; startingTeam: Team } {
  const random = randomFrom(hashSeed(seed));
  const startingTeam: Team = random() < 0.5 ? 'red' : 'blue';
  const otherTeam: Team = startingTeam === 'red' ? 'blue' : 'red';
  const roles = shuffled<Role>([
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill('neutral'),
    'assassin'
  ], random);
  const words = shuffled(WORDS, random).slice(0, 25);
  return { startingTeam, cards: words.map((word, index) => ({ word, role: roles[index], revealed: false })) };
}

function makeSeed() {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`.slice(0, 10).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 12).toUpperCase();
}

function seedFromUrl() {
  return new URLSearchParams(window.location.search).get('game')?.replace(/[^a-z0-9]/gi, '').slice(0, 20).toUpperCase() || makeSeed();
}

function MapCard() {
  const [seed, setSeed] = useState(seedFromUrl);
  const generated = useMemo(() => makeGame(seed), [seed]);
  const [cards, setCards] = useState<Card[]>(generated.cards);
  const [spymaster, setSpymaster] = useState(false);
  const [turn, setTurn] = useState<Team>(generated.startingTeam);
  const [clue, setClue] = useState('');
  const [clueCount, setClueCount] = useState('1');
  const [guessesLeft, setGuessesLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('game', seed);
    window.history.replaceState(null, '', url);
  }, [seed]);

  const remaining = useMemo(() => ({
    red: cards.filter(card => card.role === 'red' && !card.revealed).length,
    blue: cards.filter(card => card.role === 'blue' && !card.revealed).length
  }), [cards]);

  const assassinFound = cards.some(card => card.role === 'assassin' && card.revealed);
  const winner: Team | null = assassinFound ? (turn === 'red' ? 'blue' : 'red') : remaining.red === 0 ? 'red' : remaining.blue === 0 ? 'blue' : null;

  const revealCard = (index: number) => {
    if (cards[index].revealed || winner) return;
    const revealedRole = cards[index].role;
    setCards(current => current.map((card, cardIndex) => cardIndex === index ? { ...card, revealed: true } : card));
    if (revealedRole === 'assassin') return;

    const turnEnds = revealedRole !== turn || (guessesLeft !== null && guessesLeft <= 1);
    if (turnEnds) {
      setTurn(current => current === 'red' ? 'blue' : 'red');
      setClue('');
      setGuessesLeft(null);
    } else if (guessesLeft !== null && Number.isFinite(guessesLeft)) {
      setGuessesLeft(current => current === null ? null : current - 1);
    }
  };

  const endTurn = () => {
    setTurn(current => current === 'red' ? 'blue' : 'red');
    setClue('');
    setGuessesLeft(null);
  };

  const startClue = () => {
    if (!clue.trim()) return;
    setGuessesLeft(clueCount === '∞' ? Number.POSITIVE_INFINITY : Number(clueCount) + 1);
  };

  const resetGame = (nextSeed: string) => {
    const game = makeGame(nextSeed);
    setSeed(nextSeed);
    setCards(game.cards);
    setTurn(game.startingTeam);
    setSpymaster(false);
    setClue('');
    setGuessesLeft(null);
    setConfirmNew(false);
  };

  const newGame = () => {
    if (cards.some(card => card.revealed) && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    resetGame(makeSeed());
  };

  const shareGame = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this game link', window.location.href);
    }
  };

  return (
    <main className="game-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="./" aria-label="Codenames home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>CODENAMES</span>
        </a>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={shareGame} aria-label="Share this board">
            <span aria-hidden="true">↗</span><span className="action-label">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <button className="new-game-button" type="button" onClick={newGame}>
            {confirmNew ? 'Tap again to confirm' : '+ New game'}
          </button>
        </div>
      </header>

      <section className="game-layout" aria-label="Codenames game board">
        <aside className="score-card red-score" aria-label={`${remaining.red} red agents remaining`}>
          <div className="team-name"><span className="team-dot" />RED</div>
          <strong>{remaining.red}</strong>
          <span>agents left</span>
        </aside>

        <div className="board-column">
          <div className="status-row">
            <div className={`turn-chip ${turn}`}><span className="pulse-dot" />{turn} team’s turn</div>
            <button
              className={`role-toggle ${spymaster ? 'active' : ''}`}
              type="button"
              aria-pressed={spymaster}
              onClick={() => setSpymaster(current => !current)}
            >
              <span aria-hidden="true">{spymaster ? '◉' : '◎'}</span>
              {spymaster ? 'Spymaster view' : 'Operative view'}
            </button>
          </div>

          {winner && (
            <div className={`winner-banner ${winner}`} role="status">
              <span>Mission complete</span>
              <strong>{winner} team wins!</strong>
            </div>
          )}

          <div className={`word-grid ${spymaster ? 'spymaster' : ''}`}>
            {cards.map((card, index) => (
              <button
                key={`${seed}-${card.word}`}
                className={`word-card ${card.revealed || spymaster ? card.role : ''} ${card.revealed ? 'revealed' : ''}`}
                type="button"
                data-testid="map-cell"
                data-role={card.role}
                aria-label={`${card.word}${card.revealed || spymaster ? `, ${roleLabel[card.role]}` : ''}${card.revealed ? ', revealed' : ''}`}
                disabled={card.revealed || Boolean(winner)}
                onClick={() => revealCard(index)}
              >
                <span className="card-corner" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="word">{card.word}</span>
                {(card.revealed || spymaster) && <span className="role-mark" aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className="clue-desk">
            <div className="clue-copy">
              <span>Current clue</span>
              <strong>{clue.trim() || 'Waiting for spymaster…'}</strong>
            </div>
            <div className="clue-controls">
              <label className="visually-hidden" htmlFor="clue">Clue word</label>
              <input id="clue" maxLength={24} value={clue} onChange={event => setClue(event.target.value)} placeholder="Enter clue" />
              <label className="visually-hidden" htmlFor="clue-count">Clue count</label>
              <select id="clue-count" value={clueCount} onChange={event => setClueCount(event.target.value)} aria-label="Clue count">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => <option key={value}>{value}</option>)}
                <option value="∞">∞</option>
              </select>
              {guessesLeft === null ? (
                <button type="button" onClick={startClue} disabled={!clue.trim()}>Start clue</button>
              ) : (
                <button type="button" onClick={endTurn}>End turn</button>
              )}
            </div>
            {clue.trim() && (
              <div className="clue-badge" aria-label={guessesLeft === null ? `${clueCount} guesses` : `${guessesLeft === Number.POSITIVE_INFINITY ? 'unlimited' : guessesLeft} guesses remaining`}>
                {guessesLeft === Number.POSITIVE_INFINITY ? '∞' : guessesLeft ?? clueCount}
              </div>
            )}
          </div>

          <p className="board-hint"><span aria-hidden="true">◆</span> Tap a word to reveal its identity · Board <b>{seed}</b></p>
        </div>

        <aside className="score-card blue-score" aria-label={`${remaining.blue} blue agents remaining`}>
          <div className="team-name"><span className="team-dot" />BLUE</div>
          <strong>{remaining.blue}</strong>
          <span>agents left</span>
        </aside>
      </section>

      <footer>One device, two teams, twenty-five secrets.</footer>
    </main>
  );
}

export default MapCard;
