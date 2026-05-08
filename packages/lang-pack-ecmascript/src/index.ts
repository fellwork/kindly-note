// @kindly-note/lang-pack-ecmascript — public exports.
//
// spec §1.2 row `@kindly-note/lang-pack-ecmascript` defines the public surface:
//   IDENT_RE, KEYWORDS, LITERALS, BUILT_INS, BUILT_IN_VARIABLES,
//   EXTENDED_NUMBER_MODE, extendedNumberMode()
//
// Every export is named (no default). spec §0 architectural shift #1:
// importing this module has zero side effects (`package.json#sideEffects:
// false`); helpers are values, not registrations.
//
// `EXTENDED_NUMBER_RE` (the source string of EXTENDED_NUMBER_MODE.match) is
// also re-exported so language packs that need to compose the number regex
// with other patterns via `regex.concat(...)` can do so without unwrapping
// the Mode.

export {
  BUILT_INS,
  BUILT_IN_VARIABLES,
  IDENT_RE,
  KEYWORDS,
  LITERALS,
} from './constants.js';
export { EXTENDED_NUMBER_MODE, EXTENDED_NUMBER_RE, extendedNumberMode } from './number-mode.js';
