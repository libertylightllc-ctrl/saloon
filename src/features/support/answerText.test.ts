import { answerParts } from './answerText';

const shown = (body: string) => answerParts(body).map((p) => (p.bold ? `[${p.text}]` : p.text)).join('');

it('shows the assistant’s bold as bold, without the asterisks (E5)', () => {
  expect(shown('Open **More → Staff → the person** and tap **Password & sign-in**.')).toBe(
    'Open [More → Staff → the person] and tap [Password & sign-in].',
  );
  expect(answerParts('Tap **Staff**')).toEqual([
    { text: 'Tap ', bold: false },
    { text: 'Staff', bold: true },
  ]);
});

it('drops headings and list marks, and leaves plain text alone', () => {
  expect(shown('## Steps\n* Open More\n- Tap Staff\n1. Done')).toBe('Steps\n• Open More\n• Tap Staff\n1. Done');
  expect(shown('Price: 2 * 3 = 6')).toBe('Price: 2 * 3 = 6');
  expect(shown('A lone ** stays')).toBe('A lone ** stays');
});
