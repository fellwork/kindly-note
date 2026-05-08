// @kindly-note/lang-helpers — public exports.
//
// spec §1.2 row `@kindly-note/lang-helpers` defines the public surface:
//   comment(), cLineComment, cBlockComment, cNumberMode, apostropheString,
//   quoteString, phrasalWords, numberMode, binaryNumberMode, regexpMode,
//   titleMode, methodGuard, endSameAsBegin, IDENT_RE, C_NUMBER_RE,
//   BINARY_NUMBER_RE, RE_STARTERS_RE, NUMBER_RE
//
// Plus (per the dispatch's "etc." in §1.2 and upstream's modes.js intent):
//   backslashEscape, hashComment, underscoreTitleMode, shebang(),
//   MATCH_NOTHING_RE, UNDERSCORE_IDENT_RE
//
// Every export is named (no default). spec §0 shift #1: importing this module
// has zero side effects (`package.json#sideEffects: false`); helpers are
// values, not registrations.

export * from './modes.js';
export * from './regex-constants.js';
