// Scope-to-CSS-class mapping for @kindly-note/emitters-html.
//
// Mirrors the algorithm from upstream highlight.js's `scopeToCSSClass`
// (Scout §5 / upstream `src/lib/html_renderer.js`). Reproduced here because
// the tier-suffix convention is a load-bearing part of the public theme
// contract — existing CSS themes (and the `@kindly-note/themes-default`
// `compat-hljs.css` layer per spec §7.4) target these exact class strings.
//
// Three branches:
//
//   1. `language:foo` → `language-foo` (no prefix, sub-language wrapper).
//      The `language:` form is what the upstream emitter produced when
//      wrapping a sub-language span; we keep the same convention so
//      hljs-prefixed themes targeting `.language-foo` still apply.
//
//   2. Tiered scope `a.b.c` → `<prefix>a b_ c__` (multi-class). Each tier
//      after the first gets one extra trailing `_` per nesting level. Verbatim
//      from upstream. Spec §7.4 calls this out explicitly.
//
//   3. Simple scope `keyword` → `<prefix>keyword`.

/**
 * Produce the CSS class string for a scope name under the given prefix.
 *
 * @example
 *   toClassNames('keyword', 'kn-')              // 'kn-keyword'
 *   toClassNames('title.class.inherited', 'kn-') // 'kn-title class_ inherited__'
 *   toClassNames('language:json', 'kn-')        // 'language-json' (prefix ignored)
 */
export function toClassNames(scope: string, prefix: string): string {
  if (scope.startsWith('language:')) {
    // Prefix is ignored for the language wrapper. Spec §7.4 / Scout §5.
    return `language-${scope.slice('language:'.length)}`;
  }
  if (scope.includes('.')) {
    const pieces = scope.split('.');
    const head = pieces[0] ?? '';
    const tail = pieces.slice(1);
    const tailClasses = tail.map((piece, i) => `${piece}${'_'.repeat(i + 1)}`);
    return [`${prefix}${head}`, ...tailClasses].join(' ');
  }
  return `${prefix}${scope}`;
}
