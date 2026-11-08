/**
 * The API answers at most 1,000 rows a request (max_rows in supabase/config.toml; PAGE must not be more). A list that
 * can be longer is read page by page, in a fixed order, so nothing past the first 1,000 goes missing.
 */
export const PAGE = 1000;

export async function allPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}
