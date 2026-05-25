// HTML escaping + Unicode bidi-control normalisation for
// @kindly-note/emitters-markdown.
//
// spec §13.1 security table:
//   - Raw HTML in markdown source is ESCAPED by default (text path). The five
//     XML/HTML special characters are escaped, matching @kindly-note/emitters-html's
//     `htmlEscape` over-escape policy (apostrophe + quote included so the same
//     string is safe in both text and attribute positions).
//   - Unicode bidirectional control characters are normalised to U+FFFD by
//     default (mitigates the "trojan-source" class of attacks — CVE-2021-42574).
//     Override via `preserveBidiControls: true`.

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
});

const ESCAPE_RE = /[&<>"']/g;

/**
 * Escape the five HTML special characters. Pure, allocation-light, DOM-free.
 * Safe for BOTH text content and double/single-quoted attribute values.
 */
export function htmlEscape(value: string): string {
  if (!ESCAPE_RE.test(value)) return value;
  ESCAPE_RE.lastIndex = 0;
  return value.replace(ESCAPE_RE, (ch) => ESCAPES[ch] ?? ch);
}

// Unicode bidirectional + invisible formatting controls abused by the
// "trojan-source" attack (Boucher & Anderson, 2021 / CVE-2021-42574). We
// normalise the explicit bidi overrides/embeddings/isolates and the
// zero-width / BOM characters that hide payloads in rendered markdown.
//
//   ALM  U+061C
//   LRM  U+200E  RLM  U+200F
//   ZWSP U+200B  ZWNJ U+200C  ZWJ  U+200D
//   LRE  U+202A  RLE  U+202B  PDF  U+202C  LRO U+202D  RLO U+202E
//   LRI  U+2066  RLI  U+2067  FSI  U+2068  PDI U+2069
//   BOM / ZWNBSP U+FEFF
//
// Written with explicit \u escapes so the source carries no literal invisible
// code points (which editors / linters would strip or reorder).
const BIDI_CONTROL_RE = /[\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const REPLACEMENT_CHAR = '�';

/**
 * Replace Unicode bidi / invisible control characters with U+FFFD. spec §13.1
 * (bidi-control row). Applied to ALL user text before escaping unless the
 * caller opts into `preserveBidiControls: true`.
 */
export function normalizeBidi(value: string): string {
  if (!BIDI_CONTROL_RE.test(value)) return value;
  BIDI_CONTROL_RE.lastIndex = 0;
  return value.replace(BIDI_CONTROL_RE, REPLACEMENT_CHAR);
}
