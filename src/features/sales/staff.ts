/** Who worked on a sale (pure; used by the list, the sale page and every receipt). */
export type StaffName = { full_name: string } | null;

/** Everyone who worked on a sale, once each: "Rafiq" or "Rafiq, Sameer". */
export function staffNames(sale: { employees: StaffName; sale_lines: { employees: StaffName }[] }): string {
  const names = [sale.employees?.full_name, ...sale.sale_lines.map((l) => l.employees?.full_name)].filter(
    (n): n is string => Boolean(n),
  );
  return [...new Set(names)].join(', ');
}
