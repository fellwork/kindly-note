// Parse the language name out of an element's class attribute.
//
// spec §7.1.5 + Scout §11 (do-not-break list): the upstream `highlightElement`
// reads the language from `class="language-foo"` / `lang-foo`. Upstream's
// regex (`src/highlight.js:73`) is `/\blang(?:uage)?-([\w-]+)\b/i`.
// kindly-note also accepts the prefixed form `kn-language-foo` so projects
// that explicitly bracket their stack with kindly-note classes can do so
// without colliding with the legacy `language-` convention. The match order
// is: `kn-language-` → `language-` → `lang-`. The first hit wins.
//
// We intentionally do NOT walk the parent's classList (upstream does — the
// `<pre>` may carry the class instead of the `<code>`). That's a §F
// deliberate scope choice: upstream's parent-walk surprises users who put
// the class on `<pre>` when they meant `<code>`. The browser package's
// `highlightAll` selector defaults to `'pre code'` — the developer can
// place the class on either node and the SELECTOR walks up; we treat the
// matched element's class as the source of truth. If a future caller needs
// upstream's parent-walk behaviour, they can pass an explicit `language` to
// `highlightElement(...)`.
//
// (Reference, not a copy: upstream's regex inspires the form; we add the
// kindly-note prefix and skip the parent-walk.)

const KN_LANGUAGE_RE = /(?:^|\s)kn-language-([\w-]+)(?:\s|$)/i;
const LANGUAGE_RE = /(?:^|\s)language-([\w-]+)(?:\s|$)/i;
const LANG_RE = /(?:^|\s)lang-([\w-]+)(?:\s|$)/i;

/**
 * Extract a language token from an element's `class` attribute.
 *
 * Returns the matched language name (preserves casing as written), or
 * `undefined` when no recognised class is present. The empty string is
 * never returned — a malformed class like `"language-"` does not match
 * the `[\w-]+` capture group.
 */
export function languageFromClass(el: Element): string | undefined {
  const classes = typeof el.className === 'string' ? el.className : '';

  const knMatch = KN_LANGUAGE_RE.exec(classes);
  if (knMatch?.[1] !== undefined) return knMatch[1];

  const langMatch = LANGUAGE_RE.exec(classes);
  if (langMatch?.[1] !== undefined) return langMatch[1];

  const shortMatch = LANG_RE.exec(classes);
  if (shortMatch?.[1] !== undefined) return shortMatch[1];

  return undefined;
}
