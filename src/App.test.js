import { act, fireEvent, render, screen } from '@testing-library/react';
import MapCard from './components/map-card';
import App from './App';

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
  window.history.replaceState(null, '', '/');
});

test.each(['/', '/?game=sample', '/#', '/#/', '/#/?game=sample', '/#/#section', '/#?game=sample', '/#//', '/#///'])('direct visit to %s renders the map', url => {
  window.history.replaceState(null, '', url);
  render(<App />);
  expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled();
  expect(screen.getAllByTestId('map-cell')).toHaveLength(25);
});

test.each(['/#missing', '/#/missing', '/#/missing?x=1', '/#/missing#section', '/#/%2F', '/#/%', '/#/.', '/#/..'])('direct visit to %s preserves the not-found fallback', url => {
  window.history.replaceState(null, '', url);
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Unexpected Application Error!' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '404 Not Found' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Randomize' })).not.toBeInTheDocument();
});

test('root hash query changes preserve the mounted board and unsupported hashes unmount it', () => {
  render(<App />);
  const button = screen.getByRole('button', { name: 'Randomize' });
  act(() => {
    window.history.pushState(null, '', '/#/?game=sample');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(screen.getByRole('button', { name: 'Randomize' })).toBe(button);

  act(() => {
    window.history.pushState(null, '', '/#/missing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { name: '404 Not Found' })).toBeVisible();

  act(() => {
    window.history.replaceState(null, '', '/#/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Randomize' })).not.toBe(button);
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
