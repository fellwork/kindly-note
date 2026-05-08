// Internal deep-freeze utility for Mode-shaped values.
//
// spec §0 architectural shift #2 + §9.1: language definitions and the helpers
// that compose them are deep-frozen. Helpers in this package SHALL return
// frozen objects so a misbehaving language pack cannot smuggle in a mutable
// reference and corrupt shared state across highlighters (a problem upstream
// has — see spec §9.2).
//
// This is a small, focused freeze walker — distinct from the deep-freezer in
// @kindly-note/core/language.ts (which is scoped to LanguageDefinition's
// shape). Duplicating the few lines here is cheaper than re-exporting from
// core, since this package depends on core for *types only* (§1.2).

/**
 * Recursively freeze `value` and every plain-object / array reachable from
 * it. RegExp instances are intentionally skipped — `Object.freeze`-ing a
 * RegExp is a no-op in V8 and would surprise readers; the matcher treats
 * RegExp as opaque. Cycles are guarded via a WeakSet, though Mode trees in
 * helpers never contain cycles.
 */
export function deepFreeze<T>(value: T): T {
  walk(value, new WeakSet());
  return value;
}

function walk(value: unknown, seen: WeakSet<object>): void {
  if (value === null) return;
  if (typeof value !== 'object') return;
  if (value instanceof RegExp) return;
  if (seen.has(value as object)) return;
  seen.add(value as object);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    walk((value as Record<string, unknown>)[key], seen);
  }
  Object.freeze(value);
}
