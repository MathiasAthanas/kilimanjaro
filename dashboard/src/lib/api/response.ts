/**
 * Shared API response normalizers.
 *
 * The backend may return any of these shapes:
 *   • plain array                           → []
 *   • { items: [] }                         → wrapped by items key
 *   • { data: [] }                          → axios-unwrapped array
 *   • { data: { items: [] } }               → standard envelope
 *   • { data: { invoices: [] } }            → camelCase domain key
 *   • { data: { fee_structures: [] } }      → snake_case domain key
 *   • { data: { data: { items: [] } } }     → double-wrapped (rare)
 *
 * Rule: if the UI will .map() it, the hook must use arrayFromApi().
 */

/** Strip one or two layers of { data: ... } wrapping from an axios response. */
export function payloadOf(response: { data?: unknown }): unknown {
  let payload = response.data;
  for (let i = 0; i < 2; i += 1) {
    if (!payload || typeof payload !== 'object' || !('data' in payload)) break;
    payload = (payload as { data?: unknown }).data;
  }
  return payload;
}

/**
 * Convert camelCase or PascalCase to snake_case so we can match both forms
 * without having to list every variant manually.
 * e.g. "feeStructures" → "fee_structures", "FeeStructures" → "fee_structures"
 */
function toSnake(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Coerce an unknown API value to a plain array.
 *
 * Resolution order (first match wins):
 *   1. Already an array                      → return it as-is
 *   2. Has `.items` array                    → return `.items`
 *   3. Has an explicit `keys` hint match     → return that value
 *      (also checks the snake_case variant of each hint automatically)
 *   4. Object has exactly ONE array value    → return it (unambiguous fallback)
 *   5. Anything else                         → return []
 *
 * Step 4 is the key addition: it means that even if the backend uses a key
 * name we didn't anticipate (e.g. `fee_structures` when we only listed
 * `feeStructures`), the function still finds the array as long as it is the
 * only array in the payload object.
 */
/**
 * Remove duplicate objects from an array, keeping the first occurrence of each
 * unique `id`. Guards against backend returning the same record more than once
 * (pagination overlap, aggregation duplicates, etc.).
 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function arrayFromApi(value: unknown, keys: string[] = []): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;

  // 1. Standard "items" envelope
  if (Array.isArray(record.items)) return record.items;

  // 2. Explicit hint keys (plus their snake_case equivalents)
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
    const snake = toSnake(key);
    if (snake !== key && Array.isArray(record[snake])) return record[snake] as unknown[];
  }

  // 3. Unambiguous fallback: the object has exactly one array value
  const arrays = Object.values(record).filter(Array.isArray) as unknown[][];
  if (arrays.length === 1) return arrays[0];

  return [];
}
