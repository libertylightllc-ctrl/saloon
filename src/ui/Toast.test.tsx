/** A confirmation must stay on screen for its full time, even right after another one. */
import { act, screen } from '@testing-library/react-native';

import { renderInApp } from './testUtils';
import { TOAST_MS, useToast } from './Toast';

let show: ReturnType<typeof useToast>;
function Grab() {
  show = useToast();
  return null;
}

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("a new toast is not cut short by the previous toast's timer", async () => {
  await renderInApp(<Grab />);
  await act(async () => show('Booked Omar'));
  await advance(TOAST_MS - 800);
  expect(screen.getByText('Booked Omar')).toBeTruthy();

  await act(async () => show('Marked Omar as no-show'));
  expect(screen.getByText('Marked Omar as no-show')).toBeTruthy();

  // The first toast's time runs out now; the second must still be showing.
  await advance(1500);
  expect(screen.getByText('Marked Omar as no-show')).toBeTruthy();

  // …and it leaves when its own time is up.
  await advance(TOAST_MS);
  expect(screen.queryByText('Marked Omar as no-show')).toBeNull();
});

it('a single toast shows for its time, then leaves', async () => {
  await renderInApp(<Grab />);
  await act(async () => show('Sale saved'));
  await advance(TOAST_MS - 100);
  expect(screen.getByText('Sale saved')).toBeTruthy();
  await advance(200);
  expect(screen.queryByText('Sale saved')).toBeNull();
});
