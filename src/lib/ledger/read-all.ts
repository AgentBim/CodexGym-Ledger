type Page<T> = { data: T[] | null; error: { message: string } | null };
/** Read every row needed for money totals; PostgREST caps individual responses. */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<Page<T>> {
  const data: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) return { data: null, error: result.error };
    data.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < size) return { data, error: null };
  }
}
