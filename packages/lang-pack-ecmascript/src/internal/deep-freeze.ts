// Internal deep-freeze utility for Mode-shaped values.
//
// spec §0 architectural shift #2 + §9.1: language definitions and the helpers
// that compose them are deep-frozen. The Mode constant `EXTENDED_NUMBER_MODE`
// in this package and every Mode produced by `extendedNumberMode()` SHALL be
// frozen so a misbehaving language pack cannot smuggle in a mutable reference
// and corrupt shared state across highlighters (spec §9.2).
//
// This is intentionally a small, focused freeze walker — distinct from the
// deep-freezer in `@kindly-note/core/language.ts` (scoped to LanguageDefinition)
// and the one in `@kindly-note/lang-helpers/internal/deep-freeze.ts`. Spec §1.2
// pins lang-pack-ecmascript's runtime-edge dependencies to lang-helpers (Mode
// helpers) + core (types only). Duplicating six lines is cheaper than crossing
// the types-only edge to import a shared util. This matches the rationale from
// build-manifest-c2a.md (lang-helpers' equivalent file).

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
