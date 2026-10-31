/**
 * "Test salon" in Console → Salons (final brief E1): shows whether the salon is a test salon, marks or unmarks it, and
 * says so by name.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { TestSalonSwitch } from './TestSalonSwitch';

const mockMutate = jest.fn();
jest.mock('./api', () => ({
  useTestSalons: () => ({ data: new Set(['b-test']) }),
  useSetTestSalon: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));
// The bottom sheet's animation library does not load in tests; this switch has none.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

beforeEach(() => mockMutate.mockReset());

it('is off for a real salon and marks it as a test salon', async () => {
  await renderInApp(<TestSalonSwitch salon={{ business_id: 'b-real', name: 'Asil Trims' }} />);
  const toggle = screen.getByTestId('console-test-salon');
  expect(toggle.props.value).toBe(false);
  expect(screen.getByText(/Left out of the Overview numbers and the pilot’s places/)).toBeTruthy();
  await fireEvent(toggle, 'valueChange', true);
  expect(mockMutate).toHaveBeenCalledWith({ businessId: 'b-real', test: true }, expect.anything());
});

it('is on for a test salon and unmarks it', async () => {
  await renderInApp(<TestSalonSwitch salon={{ business_id: 'b-test', name: 'Red Rose' }} />);
  const toggle = screen.getByTestId('console-test-salon');
  expect(toggle.props.value).toBe(true);
  await fireEvent(toggle, 'valueChange', false);
  expect(mockMutate).toHaveBeenCalledWith({ businessId: 'b-test', test: false }, expect.anything());
});
