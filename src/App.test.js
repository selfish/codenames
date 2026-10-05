import { fireEvent, render, screen } from '@testing-library/react';
import MapCard from './components/map-card';

beforeEach(() => {
  window.history.replaceState(null, '', '/?game=TESTBOARD');
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders a complete playable board with valid role distribution', () => {
  render(<MapCard />);

  const cards = screen.getAllByTestId('map-cell');
  expect(cards).toHaveLength(25);

  const roles = cards.map(card => card.dataset.role);
  expect(roles.filter(role => role === 'assassin')).toHaveLength(1);
  expect(roles.filter(role => role === 'neutral')).toHaveLength(7);
  expect([
    roles.filter(role => role === 'red').length,
    roles.filter(role => role === 'blue').length,
  ].sort()).toEqual([8, 9]);
  expect(screen.getByText('TESTBOARD')).toBeVisible();
});

test('reveals cards and updates the matching team score', () => {
  render(<MapCard />);
  const redCard = screen.getAllByTestId('map-cell').find(card => card.dataset.role === 'red');
  expect(redCard).toBeDefined();

  const initialRedScore = Number(screen.getByLabelText(/red agents remaining/i).querySelector('strong').textContent);
  fireEvent.click(redCard);

  expect(redCard).toBeDisabled();
  expect(redCard).toHaveClass('revealed', 'red');
  expect(screen.getByLabelText(`${initialRedScore - 1} red agents remaining`)).toBeVisible();
});

test('supports spymaster view and turn controls', () => {
  render(<MapCard />);

  const viewToggle = screen.getByRole('button', { name: 'Operative view' });
  fireEvent.click(viewToggle);
  expect(screen.getByRole('button', { name: 'Spymaster view' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByTestId('map-cell')[0]).toHaveAccessibleName(/(agent|bystander|assassin)/i);

  const currentTurn = screen.getByText(/team’s turn/i).textContent;
  fireEvent.change(screen.getByLabelText('Clue word'), { target: { value: 'Ocean' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start clue' }));
  fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
  expect(screen.getByText(/team’s turn/i).textContent).not.toBe(currentTurn);
});

test('ends the turn automatically after an incorrect guess', () => {
  render(<MapCard />);
  const currentTurn = screen.getByText(/team’s turn/i).textContent;
  const activeRole = currentTurn.toLowerCase().includes('red') ? 'red' : 'blue';
  const wrongCard = screen.getAllByTestId('map-cell').find(card =>
    card.dataset.role !== activeRole && card.dataset.role !== 'assassin'
  );

  fireEvent.click(wrongCard);
  expect(screen.getByText(/team’s turn/i).textContent).not.toBe(currentTurn);
});

test('accepts and displays a clue', () => {
  render(<MapCard />);
  fireEvent.change(screen.getByLabelText('Clue word'), { target: { value: 'Ocean' } });
  fireEvent.change(screen.getByLabelText('Clue count'), { target: { value: '3' } });

  expect(screen.getByText('Ocean')).toBeVisible();
  expect(screen.getByLabelText('3 guesses')).toBeVisible();
});

function activeTeam() {
  return screen.getByText(/team’s turn/i).textContent.includes('red') ? 'red' : 'blue';
}

function startClue(count) {
  fireEvent.change(screen.getByLabelText('Clue word'), { target: { value: 'Ocean' } });
  fireEvent.change(screen.getByLabelText('Clue count'), { target: { value: count } });
  fireEvent.click(screen.getByRole('button', { name: 'Start clue' }));
}

test('recreates identical words, roles, and starting team from a shared seed', () => {
  const first = render(<MapCard />);
  const board = screen.getAllByTestId('map-cell').map(card => ({
    word: card.querySelector('.word').textContent,
    role: card.dataset.role,
  }));
  const team = activeTeam();
  expect(new Set(board.map(card => card.word)).size).toBe(25);
  expect(board.filter(card => card.role === team)).toHaveLength(9);
  first.unmount();

  // Exercise a copied URL, rather than internal generator functions.
  const sharedUrl = window.location.href;
  window.history.replaceState(null, '', '/');
  window.history.replaceState(null, '', sharedUrl);
  render(<MapCard />);

  expect(screen.getAllByTestId('map-cell').map(card => ({
    word: card.querySelector('.word').textContent,
    role: card.dataset.role,
  }))).toEqual(board);
  expect(activeTeam()).toBe(team);
});

test('an assassin awards the other team victory and prevents further reveals', () => {
  render(<MapCard />);
  const losingTeam = activeTeam();
  const cards = screen.getAllByTestId('map-cell');
  const assassin = cards.find(card => card.dataset.role === 'assassin');
  fireEvent.click(assassin);

  expect(screen.getByRole('status')).toHaveTextContent(`${losingTeam === 'red' ? 'blue' : 'red'} team wins!`);
  expect(cards.every(card => card.disabled)).toBe(true);
  expect(cards.filter(card => card.classList.contains('revealed'))).toEqual([assassin]);
  fireEvent.click(cards.find(card => card !== assassin));
  expect(cards.filter(card => card.classList.contains('revealed'))).toEqual([assassin]);
});

test.each(['active', 'opposing'])('revealing the final %s agent awards its team victory', relation => {
  render(<MapCard />);
  const team = relation === 'active' ? activeTeam() : activeTeam() === 'red' ? 'blue' : 'red';
  const teamCards = screen.getAllByTestId('map-cell').filter(card => card.dataset.role === team);

  teamCards.forEach((card, index) => {
    fireEvent.click(card);
    if (index < teamCards.length - 1) expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  expect(screen.getByLabelText(`0 ${team} agents remaining`)).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent(`${team} team wins!`);
  expect(screen.getAllByTestId('map-cell').every(card => card.disabled)).toBe(true);
});

test('a numbered clue allows one bonus guess, then changes turn and clears the clue', () => {
  render(<MapCard />);
  const team = activeTeam();
  const teamCards = screen.getAllByTestId('map-cell').filter(card => card.dataset.role === team);
  startClue('1');
  expect(screen.getByLabelText('2 guesses remaining')).toBeVisible();

  fireEvent.click(teamCards[0]);
  expect(activeTeam()).toBe(team);
  expect(screen.getByLabelText('1 guesses remaining')).toBeVisible();
  // A revealed card cannot consume the extra guess.
  fireEvent.click(teamCards[0]);
  expect(screen.getByLabelText('1 guesses remaining')).toBeVisible();
  fireEvent.click(teamCards[1]);

  expect(activeTeam()).not.toBe(team);
  expect(screen.getByLabelText('Clue word')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Start clue' })).toBeDisabled();
  expect(screen.queryByLabelText(/guesses remaining/)).not.toBeInTheDocument();
});

test('an unlimited clue keeps the turn after multiple correct guesses', () => {
  render(<MapCard />);
  const team = activeTeam();
  startClue('∞');
  screen.getAllByTestId('map-cell').filter(card => card.dataset.role === team).slice(0, 3)
    .forEach(card => fireEvent.click(card));

  expect(activeTeam()).toBe(team);
  expect(screen.getByLabelText('unlimited guesses remaining')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
  expect(activeTeam()).not.toBe(team);
  expect(screen.getByLabelText('Clue word')).toHaveValue('');
});

test.each(['neutral', 'opponent'])('%s guess ends an active clue immediately', role => {
  render(<MapCard />);
  const team = activeTeam();
  const targetRole = role === 'opponent' ? (team === 'red' ? 'blue' : 'red') : role;
  startClue('3');
  fireEvent.click(screen.getAllByTestId('map-cell').find(card => card.dataset.role === targetRole));

  expect(activeTeam()).not.toBe(team);
  expect(screen.getByLabelText('Clue word')).toHaveValue('');
  expect(screen.queryByLabelText(/guesses remaining/)).not.toBeInTheDocument();
});

test('new game preserves progress until confirmation, then resets the board, turn, clue, and view', () => {
  // This Jest/jsdom environment has no Web Crypto, so exercise the seed fallback.
  jest.spyOn(Math, 'random').mockReturnValue(0.25);
  render(<MapCard />);
  fireEvent.click(screen.getByRole('button', { name: 'Operative view' }));
  startClue('∞');
  const firstCard = screen.getAllByTestId('map-cell').find(card => card.dataset.role === activeTeam());
  fireEvent.click(firstCard);
  fireEvent.click(screen.getByRole('button', { name: '+ New game' }));

  expect(new URLSearchParams(window.location.search).get('game')).toBe('TESTBOARD');
  expect(firstCard).toHaveClass('revealed');
  expect(screen.getByRole('button', { name: 'Spymaster view' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('unlimited guesses remaining')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }));

  const nextSeed = (0.25).toString(36).slice(2, 12).toUpperCase();
  expect(new URLSearchParams(window.location.search).get('game')).toBe(nextSeed);
  expect(screen.getByText(nextSeed, { selector: 'b' })).toBeVisible();
  const newCards = screen.getAllByTestId('map-cell');
  expect(newCards.every(card => !card.disabled && !card.classList.contains('revealed'))).toBe(true);
  expect(screen.getByRole('button', { name: 'Operative view' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByLabelText('Clue word')).toHaveValue('');
  expect(screen.queryByLabelText(/guesses remaining/)).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByLabelText(`9 ${activeTeam()} agents remaining`)).toBeVisible();
});
