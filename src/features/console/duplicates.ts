/** Another salon in a "possible duplicate" line: its name, and its code to tell salons with the same name apart. */
export interface OtherSalon {
  name: string;
  code: string;
}

/**
 * "Same owner name as Palm Salon (palm22), Palm Salon (palm7), Cedar Cuts" (owner's brief A2): a name
 * that appears twice in the list, or is this salon's own name, gets its code.
 */
export function otherSalons(others: OtherSalon[], ownName: string): string {
  const seen = new Map<string, number>();
  for (const o of others) seen.set(o.name.toLowerCase(), (seen.get(o.name.toLowerCase()) ?? 0) + 1);
  return others
    .map((o) => ((seen.get(o.name.toLowerCase()) ?? 0) > 1 || o.name.toLowerCase() === ownName.toLowerCase() ? `${o.name} (${o.code})` : o.name))
    .join(', ');
}
