import { act, fireEvent, render, screen } from '@testing-library/react';
import MapCard from './components/map-card';

const normalizeColor = color => {
  const style = document.createElement('div').style;
  style.backgroundColor = color;
  return style.backgroundColor;
};

const countCellsByColor = (cells, color) =>
  cells.filter(cell => cell.style.backgroundColor === normalizeColor(color)).length;

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('starts with an enabled randomize control', () => {
  render(<MapCard />);

  expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled();
});

test('generates a valid 25-cell map and announces the starting team', async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  render(<MapCard />);

  const randomizeButton = screen.getByRole('button', { name: 'Randomize' });
  fireEvent.click(randomizeButton);
  expect(randomizeButton).toBeDisabled();

  await act(async () => {
    for (let shuffle = 0; shuffle < 6; shuffle += 1) {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    }
    jest.advanceTimersByTime(500);
    await Promise.resolve();
  });

  expect(randomizeButton).toBeEnabled();
  expect(screen.getByRole('heading', { name: 'Red Starts' })).toBeVisible();

  const cells = screen.getAllByTestId('map-cell');
  expect(cells).toHaveLength(25);
  expect(countCellsByColor(cells, '#111111')).toBe(1);
  expect(countCellsByColor(cells, '#e6dfa7')).toBe(7);

  const teamCounts = [
    countCellsByColor(cells, '#dc4347'),
    countCellsByColor(cells, '#3c83b1'),
  ].sort();
  expect(teamCounts).toEqual([8, 9]);
});
