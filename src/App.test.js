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
