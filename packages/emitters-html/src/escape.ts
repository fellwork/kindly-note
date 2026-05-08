// HTML attribute-and-text escaping for the @kindly-note/emitters-html package.
//
// We escape the five XML/HTML characters specified by the WHATWG HTML
// serialization algorithm for both attribute values and text content
// (https://html.spec.whatwg.org/multipage/parsing.html#serialising-html-fragments):
//   &  →  &amp;
//   <  →  &lt;
//   >  →  &gt;
//   "  →  &quot;
//   '  →  &#x27;
//
// The output of this emitter is concatenated as raw HTML text — it must be
// safe to drop into an `innerHTML` or a server-rendered template without
// further escaping. Escaping the apostrophe (the WHATWG algorithm only
// requires `&` and `<` for text content; `&` and `"` for attribute values)
// is a deliberate over-escape: matches upstream highlight.js's
// `escapeHTML` (Scout §5; upstream `src/lib/utils.js`) and is friendly to
// XML / SGML / older HTML parsers.

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
});

const ESCAPE_RE = /[&<>"']/g;

/**
 * Escape the five HTML special characters. Pure, allocation-light, and free
 * of any DOM dependency.
 */
export function htmlEscape(value: string): string {
  // Fast path: most highlighted text is ASCII source code without HTML
  // metacharacters. Avoid the regex scan when we can.
  if (!ESCAPE_RE.test(value)) return value;
  // RegExp.test mutates `lastIndex` on global regexes; reset before replace.
  ESCAPE_RE.lastIndex = 0;
  return value.replace(ESCAPE_RE, (ch) => ESCAPES[ch] ?? ch);
}
