// `@kindly-note/themes-default` — first-party CSS theme set.
//
// CSS-only package. No runtime behaviour. The default JS export is a
// re-export of `tokens.json` (the design-token bundle), so design-system
// consumers can `import { themes } from '@kindly-note/themes-default'`
// and get a typed object instead of pulling JSON imperatively.
//
// The actual themes are CSS files: import them via the package subpaths:
//
//   import '@kindly-note/themes-default/dark.css';
//   import '@kindly-note/themes-default/light.css';
//   import '@kindly-note/themes-default/high-contrast.css';
//
// Or, for users who want to keep their existing `hljs-*` themes but use
// kindly-note's `kn-*` rendering output:
//
//   import '@kindly-note/themes-default/compat-hljs.css';
//
// spec §1.2 (row `@kindly-note/themes-default`); §7.4 (the kn-/hljs- decision
// and theme story); §5.3 (tier-suffix scope-to-class mapping that themes
// target).

// Workaround for `allowSyntheticDefaultImports: false` +
// `verbatimModuleSyntax: true` (tsconfig.base.json): TS treats `* as` on a
// JSON module as the value itself, not a namespace wrapping a `default`. We
// rename it to `tokens` for downstream readability.
import * as tokens from './tokens.json' with { type: 'json' };

/**
 * The design-token bundle for `@kindly-note/themes-default`.
 *
 * Each named theme (`dark`, `light`, `high-contrast`) contains a `palette`
 * keyed by semantic scope name (`keyword`, `string`, `comment`, etc.). The
 * CSS files in this package consume these palette values as CSS custom
 * properties on `:root`.
 *
 * Useful for design-system integration — e.g. surfacing the kindly-note
 * theme palette in a Storybook colour panel, or generating a theme switcher
 * that mirrors the in-page palette.
 */
export const themes = tokens.themes;

/**
 * The font stack used by the default themes (`ui-monospace, …`).
 */
export const fonts = tokens.fonts;

export default tokens;
