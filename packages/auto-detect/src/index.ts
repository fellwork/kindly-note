// @kindly-note/auto-detect — public exports.
//
// spec §1.2 row `@kindly-note/auto-detect`:
//   - Auto-detection algorithm (`highlightAuto` upstream); pure function over
//     a registered language set. Includes `supersetOf` tie-breaking.
//   - Public surface: `createAutoDetector`, `AutoDetectResult`, `AutoDetectOptions`.
//   - Depends on: `@kindly-note/core` only.
//
// Implementation reference: Scout §6 (upstream's `highlightAuto` impl in
// `src/highlight.js:685-722`). NOT a byte-copy — the algorithm is the same
// (iterate registered languages, score each, sort with supersetOf fallback)
// but the typing, the `subset` / `includeDisabled` / `preferLanguage` knobs,
// and the "no synthetic plaintext fallback" choice are kindly-note-native.

export {
  createAutoDetector,
  type AutoDetectOptions,
  type AutoDetectResult,
  type AutoDetector,
} from './detector.js';
