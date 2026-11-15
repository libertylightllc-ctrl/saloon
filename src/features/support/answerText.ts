/**
 * The assistant's answers as plain text with bold (owner's app check E5). The assistant is told to write plain text,
 * but a model can still send Markdown: "**Staff**" shows as bold "Staff", a "# heading" as its text and a "* " or "- "
 * list mark as "• ". What a person types is shown exactly as typed.
 */
export interface AnswerPart {
  text: string;
  bold: boolean;
}

export function answerParts(body: string): AnswerPart[] {
  const lines = body
    .split('\n')
    .map((line) => line.replace(/^(\s*)#{1,6}\s+/, '$1').replace(/^(\s*)[*-]\s+/, '$1• '))
    .join('\n');
  const parts: AnswerPart[] = [];
  let last = 0;
  for (const m of lines.matchAll(/\*\*(.+?)\*\*|__(.+?)__/gs)) {
    if (m.index > last) parts.push({ text: lines.slice(last, m.index), bold: false });
    parts.push({ text: m[1] ?? m[2] ?? '', bold: true });
    last = m.index + m[0].length;
  }
  if (last < lines.length) parts.push({ text: lines.slice(last), bold: false });
  return parts;
}
