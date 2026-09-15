/**
 * Extracts a message from a caught value without assuming it's an Error —
 * `catch` binds `unknown` under strict TS, and something can always
 * `throw` a non-Error. Returns undefined (not a stringified fallback) so
 * callers can chain their own `?? 'default message'`.
 */
export function getErrorMessage(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}
