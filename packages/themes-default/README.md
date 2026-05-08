# @kindly-note/themes-default

First-party CSS theme set for kindly-note's default `kn-` class scheme: `dark`, `light`, `high-contrast`, plus an opt-in `compat-hljs.css` shim for users transitioning from third-party `hljs-*` themes. CSS-only — no JavaScript runtime, no DOM dependencies.

## Install

```sh
npm install @kindly-note/themes-default
bun add @kindly-note/themes-default
pnpm add @kindly-note/themes-default
```

## Usage

Pick a theme and import its CSS via the package's exports map. With a bundler (Vite, Webpack, Rolldown, Bun, etc.) or a runtime that resolves package subpaths:

```ts
import '@kindly-note/themes-default/dark.css';
// or
import '@kindly-note/themes-default/light.css';
// or
import '@kindly-note/themes-default/high-contrast.css';
```

The theme attaches to the `.kn` root that `@kindly-note/emitters-html` produces on `<pre><code>` (architect-spec §5.3, §7.4). No further configuration is required.

If your toolchain reaches files by URL (a static-site generator, plain HTML page, deno-style import map), use a `<link>` tag against the resolved subpath:

```html
<link rel="stylesheet" href="@kindly-note/themes-default/light.css">
```

The CSS subpaths are listed in `package.json#exports` and `package.json#sideEffects`, so bundlers preserve them across tree-shaking.

## Themes

| File | Inspired by | Use case |
|---|---|---|
| `dark.css` | github-dark colour family | Default dark palette — pairs cleanly with most app chrome and matches the GitHub aesthetic. |
| `light.css` | atom-one-light colour family | Default light palette — soft greys and a cool blue-violet accent. |
| `high-contrast.css` | Nord palette pulled to WCAG-AAA targets | Bold, saturated palette against pure-black background — for users who need stronger luminance separation than github-dark / atom-one-light provide. |

Each theme exposes its palette as CSS custom properties on `:root` (`--kn-bg`, `--kn-fg`, `--kn-keyword`, `--kn-string`, …), so apps can override individual values without forking the file:

```css
:root {
  --kn-keyword: hotpink;
}
```

The tier-suffix scope-to-class mapping (architect-spec §5.3 — `title.class.inherited` → `kn-title class_ inherited__`) is preserved across all three themes.

## hljs- compatibility layer

`compat-hljs.css` is a variable-mapping shim for users who want kindly-note's default `kn-*` rendering output (architect-spec §7.4) but already have a third-party theme written in the `hljs-*` convention they don't want to give up.

The shim defines rules of the form:

```css
.kn-keyword { color: var(--hljs-keyword-color, inherit); }
```

You define `--hljs-*-color` custom properties on `:root` (typically extracted from your existing hljs theme), and the shim maps each variable onto the matching `kn-*` selector:

```css
:root {
  --hljs-bg: #1e1e1e;
  --hljs-fg: #d4d4d4;
  --hljs-keyword-color: #569cd6;
  --hljs-string-color: #ce9178;
  --hljs-comment-color: #6a9955;
  /* … */
}
```

```ts
import '@kindly-note/themes-default/compat-hljs.css';
```

Each `var(--hljs-*-color, inherit)` falls back to `inherit` when undefined, so partial palettes degrade gracefully.

The inverse direction — apply a kindly-note theme to `hljs-*`-rendered output — is handled by passing `classPrefix: 'hljs-'` to `createHighlighter` (architect-spec §7.4) and importing one of the first-party themes; the `kn-*` themes do not double-emit `.hljs-*` selectors.

## Tokens

`tokens.json` is the design-token source-of-truth: three palettes (`dark`, `light`, `high-contrast`), each keyed by semantic scope name (`keyword`, `string`, `comment`, `title`, …), plus the canonical `fonts.mono` stack. The CSS files in this package consume the same values via `:root` custom properties.

Importable two ways — as raw JSON via the package subpath:

```ts
import tokens from '@kindly-note/themes-default/tokens.json';
```

…or as a typed object via the package's main entry, suitable for design-system integration (Storybook colour panel, in-app theme switcher, design-token sync tool):

```ts
import { themes, fonts } from '@kindly-note/themes-default';

themes.dark.palette.keyword;  // '#ff7b72'
themes['high-contrast'].name; // 'kindly-note high contrast'
fonts.mono;                   // 'ui-monospace, SFMono-Regular, …'
```

## Status

v0.0.1. Ships in cohort 5d of the kindly-note modernize track ([build manifest](../../docs/plan/build-manifest-c5d.md)). Surface is stable: three first-party themes, one compat shim, one token bundle. 118 smoke tests cover required-scope coverage, tier-suffix preservation, and palette validity across all four CSS files.

## License

BSD-3-Clause.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
