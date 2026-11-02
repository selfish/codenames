import React, { useEffect, useMemo, useState } from 'react';

type Team = 'red' | 'blue';
type Role = Team | 'neutral' | 'assassin';

type Card = {
  word: string;
  role: Role;
  revealed: boolean;
};

// Original vocabulary shared with the online candidate; legacy local board remains unmounted.
const WORDS = [
  "APRICOT",
  "BASIL",
  "CEDAR",
  "DAISY",
  "EGGPLANT",
  "FIG",
  "GINGER",
  "HAZEL",
  "IRIS",
  "JASMINE",
  "KALE",
  "LENTIL",
  "MULBERRY",
  "NECTAR",
  "OAT",
  "PAPRIKA",
  "QUINCE",
  "RADISH",
  "SAGE",
  "THYME",
  "VIOLET",
  "WALNUT",
  "YEAST",
  "ZUCCHINI",
  "ACORN",
  "BLOSSOM",
  "COMPOST",
  "DEWDROP",
  "FERN",
  "GREENHOUSE",
  "HEDGE",
  "IVY",
  "KERNEL",
  "LAGOON",
  "MARSH",
  "NEST",
  "ORCHARD",
  "PETAL",
  "QUARRY",
  "RIDGE",
  "SEEDLING",
  "TUNDRA",
  "VALLEY",
  "WILLOW",
  "YAM",
  "ZEST",
  "APRON",
  "BASKET",
  "CANDLE",
  "DRAWER",
  "ENVELOPE",
  "FAUCET",
  "GRATER",
  "HAMMOCK",
  "INK",
  "JAR",
  "KETTLE",
  "LADDER",
  "MIRROR",
  "NAPKIN",
  "OVEN",
  "PILLOW",
  "QUILT",
  "RIBBON",
  "SHELF",
  "THIMBLE",
  "UMBRELLA",
  "VASE",
  "WHISK",
  "ZIPPER",
  "ALLEY",
  "BAKERY",
  "CANAL",
  "DOCK",
  "ELEVATOR",
  "FOUNTAIN",
  "GARAGE",
  "HARBOR",
  "ISLAND",
  "JUNCTION",
  "KIOSK",
  "LIBRARY",
  "MARKET",
  "OBSERVATORY",
  "PAVEMENT",
  "PLAZA",
  "RESERVOIR",
  "STAIRCASE",
  "TUNNEL",
  "VIADUCT",
  "WORKSHOP",
  "YACHT",
  "ZEPPELIN",
  "ANTENNA",
  "BATTERY",
  "CIRCUIT",
  "DIAL",
  "ECHO",
  "FREQUENCY",
  "GEAR",
  "HINGE",
  "IMPULSE",
  "JOYSTICK",
  "KEYPAD",
  "LENS",
  "MAGNET",
  "NOZZLE",
  "ORBIT",
  "PRISM",
  "QUARTZ",
  "RELAY",
  "SENSOR",
  "TURBINE",
  "VALVE",
  "WAVELENGTH",
  "AXLE",
  "BUOY",
  "CHORUS",
  "DANCE",
  "ENCORE",
  "FABLE",
  "GESTURE",
  "HARMONY",
  "INTERVAL",
  "JUGGLER",
  "KITE",
  "LULLABY",
  "MURAL",
  "NARRATOR",
  "OVERTURE",
  "PUPPET",
  "RIDDLE",
  "SCULPTURE",
  "TAPESTRY",
  "VERSE",
  "WALTZ",
  "XYLOPHONE",
  "YODEL",
  "ACROBAT",
  "BALCONY",
  "COSTUME",
  "DRUMMER",
  "EASEL",
  "FESTIVAL",
  "GALLERY",
  "HAIKU",
  "ILLUSION",
  "JESTER",
  "MOSAIC",
  "PORTRAIT",
  "RHYTHM",
  "SONNET",
  "TEMPO"
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
  const [winner, setWinner] = useState<Team | null>(null);
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

  const revealCard = (index: number) => {
    if (cards[index].revealed || winner) return;
    const revealedRole = cards[index].role;
    setCards(current => current.map((card, cardIndex) => cardIndex === index ? { ...card, revealed: true } : card));
    // Record the result before any turn or clue bookkeeping can run.
    if (revealedRole === 'assassin') {
      setWinner(turn === 'red' ? 'blue' : 'red');
      return;
    }
    if ((revealedRole === 'red' || revealedRole === 'blue') && remaining[revealedRole] === 1) {
      setWinner(revealedRole);
      return;
    }

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
    if (winner) return;
    setTurn(current => current === 'red' ? 'blue' : 'red');
    setClue('');
    setGuessesLeft(null);
  };

  const startClue = () => {
    if (winner || !clue.trim()) return;
    setGuessesLeft(clueCount === '0' || clueCount === '∞' ? Number.POSITIVE_INFINITY : Number(clueCount) + 1);
  };

  const resetGame = (nextSeed: string) => {
    const game = makeGame(nextSeed);
    setSeed(nextSeed);
    setCards(game.cards);
    setWinner(null);
    setClueCount('1');
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
              <input id="clue" maxLength={24} value={clue} disabled={Boolean(winner)} onChange={event => { if (!winner) setClue(event.target.value); }} placeholder="Enter clue" />
              <label className="visually-hidden" htmlFor="clue-count">Clue count</label>
              <select id="clue-count" value={clueCount} disabled={Boolean(winner)} onChange={event => { if (!winner) setClueCount(event.target.value); }} aria-label="Clue count">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => <option key={value}>{value}</option>)}
                <option value="∞">∞</option>
              </select>
              {guessesLeft === null ? (
                <button type="button" onClick={startClue} disabled={Boolean(winner) || !clue.trim()}>Start clue</button>
              ) : (
                <button type="button" onClick={endTurn} disabled={Boolean(winner)}>End turn</button>
              )}
            </div>
            {clue.trim() && (
              <div className="clue-badge" aria-live="polite" aria-atomic="true" aria-label={guessesLeft === null ? `${clueCount} guesses` : `${guessesLeft === Number.POSITIVE_INFINITY ? 'unlimited' : guessesLeft} guesses remaining`}>
                {guessesLeft === Number.POSITIVE_INFINITY ? '∞' : guessesLeft ?? clueCount}{guessesLeft !== null && <span className="guesses-suffix"> left</span>}
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
