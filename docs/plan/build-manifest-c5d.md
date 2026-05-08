# Build manifest — Cohort 5d: `@kindly-note/themes-default`

**Date:** 2026-05-08
**Builder:** Cohort 5d (kindly-note modernize track)
**Branch:** `feat/themes-default` from `main` at `17c645c`.
**Spec contract:** `docs/plan/architect-spec.md` — §1.2 row `@kindly-note/themes-default`; §5.3 (tier-suffix scope-to-class mapping); §7.4 (the `kn-` ↔ `hljs-` decision and theme story).
**Depends on:** nothing at runtime (CSS-only package). The `kn-*` class names targeted by the CSS rules come from `@kindly-note/emitters-html`'s `scope-to-class.ts`, which is unchanged.

This cohort closes one of the last remaining package gaps: out-of-the-box,
kindly-note now ships first-party themes for its default `kn-*` prefix,
plus a compatibility shim for users transitioning from `hljs-*`-prefixed
third-party themes.

---

## Scope summary

A single CSS-only package in three theme variants plus a compat layer:

- **`@kindly-note/themes-default/dark.css`** — github-dark-inspired palette
  (palettes are not copyrightable; CSS rules written from scratch).
- **`@kindly-note/themes-default/light.css`** — atom-one-light-inspired
  palette.
- **`@kindly-note/themes-default/high-contrast.css`** — Nord-inspired
  palette pulled to WCAG-AAA contrast targets against pure-black bg.
- **`@kindly-note/themes-default/compat-hljs.css`** — a variable-mapping
  shim (Mode A) that lets users keep their existing `hljs-*` theme. Users
  define `--hljs-*-color` custom properties; this file maps them onto
  `kn-*` selectors. Inverse direction (kindly-note theme on `hljs-*`
  output) is achieved by passing `classPrefix: 'hljs-'` to
  `createHighlighter`, NOT by anything in this file.
- **`@kindly-note/themes-default/tokens.json`** — design-token bundle.
  Three palettes + the canonical font stack. Importable as JSON or via the
  package's typed default export (`import { themes } from
  '@kindly-note/themes-default'`).

---

## Files created / modified

### Workspace-level

- `vitest.shared.ts` — added `'themes-default'` to the
  `KINDLY_NOTE_PACKAGES` list so cross-package imports of
  `@kindly-note/themes-default` resolve to `src/index.ts` in tests. (No
  package today imports it — CSS-only — but the alias keeps the workspace
  pattern consistent.)
- `tsconfig.json` — added `{ "path": "./packages/themes-default" }` to
  the workspace's project references list (position 8).

### `packages/themes-default/` (new)

- `package.json` — `@kindly-note/themes-default@0.0.1`, `type: "module"`,
  exports map covering `./dark.css`, `./light.css`, `./high-contrast.css`,
  `./compat-hljs.css`, `./tokens.json`, `./package.json`, and the typed
  default at `.`. `sideEffects` lists the four CSS dist paths so bundlers
  preserve them across tree-shaking. `files: ["dist", "src", "styles"]`.
- `tsconfig.json` — minimal; emits `dist/index.{js,d.ts}` from
  `src/index.ts`. Includes `**/*.json` so `tokens.json` is in the project
  graph.
- `tsconfig.test.json` — Node-typed overlay for tests + scripts (the
  package itself has zero Node deps in publish surface).
- `vitest.config.ts` — extends `vitest.shared.ts`. Tests run in `node`
  env, read source CSS via `node:fs`.
- `src/index.ts` — typed re-export of the design tokens. Workaround for
  `allowSyntheticDefaultImports: false` in tsconfig.base.json: uses
  `import * as tokens from './tokens.json' with { type: 'json' }`. The
  `with { type: 'json' }` import attribute is needed for ESM JSON.
- `src/tokens.json` — design-token source-of-truth. Three palettes with
  bg/fg/keyword/string/etc. as `#RRGGBB` hex values.
- `styles/dark.css` — github-dark palette via `:root` custom properties.
  Targets all 28 required scopes from dispatch §C.
- `styles/light.css` — atom-one-light palette. Same scope coverage.
- `styles/high-contrast.css` — Nord-inspired bold-saturation palette
  against pure-black bg. Adds `font-weight: bold` to keyword / type /
  title for added contrast.
- `styles/compat-hljs.css` — variable-mapping shim. Maps `kn-*` selectors
  to `var(--hljs-*-color, inherit)` so users with an existing hljs theme
  can extract its palette into custom properties on `:root` and have it
  flow through to kn-prefixed output.
- `scripts/copy-assets.ts` — bun-runnable build helper. Copies
  `styles/*.css` and `src/*.json` into `dist/`. Portable across Win/Unix.
- `tests/themes.test.ts` — 118 smoke tests across 4 describe blocks:
  - First-party themes (dark/light/high-contrast): per-theme :root +
    .kn rule + 27 required-scope assertions + tier-suffix preservation +
    no-hljs-leak. (5 sub-tests × 3 themes × ~30 cases = ~85 tests.)
  - compat-hljs.css: variable-mapping bridge + 12 required-scope
    assertions + tier-suffix.
  - Package shape: name/version/exports/files.
  - tokens.json: structure + per-theme palette validation (`#RRGGBB`).

### `.changeset/`

- `themes-default-initial.md` — `'@kindly-note/themes-default': minor`.

### `docs/plan/`

- `build-manifest-c5d.md` — this file.

---

## Public exports

### `@kindly-note/themes-default`

Default JS export: the design-token bundle (typed via TS inference from
`tokens.json`).
Named JS exports: `themes`, `fonts`.

CSS subpath exports: `./dark.css`, `./light.css`, `./high-contrast.css`,
`./compat-hljs.css`. Each is a side-effectful CSS import suitable for use
with native ESM CSS modules, Vite/Webpack/etc. bundlers, or `?url`
imports.

JSON subpath: `./tokens.json` for tooling that wants the raw token
document.

---

## Acceptance gates (dispatch §E + §F)

### §E — Acceptance gates

| # | Gate | Where verified | Status |
|---|---|---|---|
| 1 | Each theme CSS file exists, parses, and contains all required class selectors from §C | `tests/themes.test.ts` first-party block (each scope checked × 3 themes) | PASS |
| 2 | No JavaScript in the package source (CSS-only) | `src/index.ts` is the only TS file — a typed re-export of tokens.json with no runtime logic | PASS |
| 3 | A simple smoke test reads CSS via fs from the test, asserts all required classes present | `tests/themes.test.ts` (118 tests) | PASS |
| 4 | `package.json#exports` maps the 4 CSS subpaths + tokens.json to actual files | Verified by `package shape` describe block | PASS |
| 5 | `tokens.json` importable as JSON (or wrapped in a tiny TS file that exports a typed object) | Both: importable as `'@kindly-note/themes-default/tokens.json'` AND wrapped in `src/index.ts` typed re-export | PASS |

### §F — Verification commands

| Command | Status |
|---|---|
| `bun install` | PASS — Resolved 249 packages (no changes after first install) |
| `bun run typecheck` (`tsc -b`) | PASS — clean |
| `bun run --filter '@kindly-note/themes-default' build` | PASS — `dist/` populated with 4 CSS files + `tokens.json` + `index.{js,d.ts}` |
| `bun run --filter '@kindly-note/themes-default' test` | PASS — 118/118 |
| `bun run lint` (Biome) | PASS — 99 files, 0 errors |
| `bun run test` (workspace) | PASS — 353/353 across 8 packages |
| `bun run build` (workspace) | PASS — all 8 packages built |
| Manual: open dark.css/light.css/high-contrast.css/compat-hljs.css | All parse — valid CSS3 syntax |

---

## Test count

| Package | Before | After | Delta |
|---|---|---|---|
| `@kindly-note/core` | 61 | 61 | 0 |
| `@kindly-note/lang-helpers` | 64 | 64 | 0 |
| `@kindly-note/emitters-html` | 31 | 31 | 0 |
| `@kindly-note/lang-pack-ecmascript` | 32 | 32 | 0 |
| `@kindly-note/lang-json` | 18 | 18 | 0 |
| `@kindly-note/lang-javascript` | 11 | 11 | 0 |
| `@kindly-note/lang-typescript` | 18 | 18 | 0 |
| `@kindly-note/themes-default` | — | **118** | +118 |
| **Workspace total** | **235** | **353** | **+118** |

---

## Design decisions

### Build approach: `tsc -b` + bun copy-assets script

The dispatch said "pick whichever is cleaner" between (a) referencing
`styles/*.css` directly from the exports map, and (b) copying to `dist/`
at build time. We chose **(b)** for two reasons:

1. **Repo consistency** — every other `@kindly-note/*` package emits to
   `dist/` and lists `dist` in `files`. Following the same pattern keeps
   `bun run build` uniform across the workspace.
2. **Single source of truth for `files`** — listing `["dist", "src",
   "styles"]` (we ship sources too for transparency) is cleaner than
   conditionally listing CSS sources only when they happen to be at the
   resolved exports path.

The asset copy is a 30-line `bun` script — no extra dependency.

### compat-hljs as variable mapping (Mode A) vs paired-selector aliasing (Mode B)

Initial implementation explored a paired-selector mode using
`:where(.kn-X, .hljs-X) {}` empty rules to alias class membership. After
verification that empty CSS rule bodies do nothing for inheritance, Mode B
was dropped. The shipped file is variable-mapping only:

```css
.kn-keyword { color: var(--hljs-keyword-color, inherit); }
```

Users define `--hljs-*-color` custom properties on `:root` (typically
extracted from their existing third-party hljs theme). This is the
approach with sound CSS semantics; documentation in the file header walks
through the workflow.

The inverse direction (apply a kindly-note theme to `hljs-*` rendered
output) is documented as: pass `classPrefix: 'hljs-'` to
`createHighlighter` and import one of the first-party themes directly.
That's spec §7.4's intended path.

### Color palettes inspired by, but not copied from, upstream

The dispatch's constraint says "color palettes can be adapted (colors are
not copyrightable in CSS form), but CSS rules must be written from
scratch." Each theme cites its inspiration in a comment header (github-
dark, atom-one-light, Nord) and uses the same family of hex values, but:

- The CSS rule structure is kindly-note's: scope groupings differ from
  upstream, custom-property-driven theming is added throughout, the
  font stack and `.kn` host rule are new.
- No upstream CSS file was copied — palettes were transcribed from each
  reference theme's hex values into `tokens.json`, then composed into
  fresh CSS rules.

### Tier-suffix preservation (spec §5.3)

All four CSS files include a `.kn-title.class_` selector (or
`.kn-title.class_.inherited__`) so spans carrying the tier-suffixed
multi-class output (e.g. `<span class="kn-title class_ inherited__">`)
still get the title-class colour. This is asserted in
`tests/themes.test.ts` for every theme.

---

## Open questions / spec ambiguities (none silent)

### #1 — `compat-hljs.css` requires user palette extraction

The shim doesn't auto-import an arbitrary third-party hljs CSS file and
forward its rules — that's not possible without a build-time
transformation. Users must extract `--hljs-*-color` values from their
existing theme into custom properties on `:root`. The file's header docs
this trade-off explicitly.

**Followup:** if users complain about the friction, a v0.1 option is to
ship a `bun create kindly-note-hljs-shim` codemod that reads an
`hljs-*.css` file, parses out its colour values, and emits a `:root` block
ready to paste alongside compat-hljs.css.

### #2 — Operator/punctuation/property scopes intentionally inherit fg

Per dispatch §C: "Don't every scope need styling? No — comments, strings,
keywords, types, numbers, literals, and titles are the most-visible. If a
scope is unstyled in your theme, it inherits the surrounding text color.
That's acceptable." The first-party themes leave `kn-operator`,
`kn-punctuation`, `kn-property`, `kn-language_`, and `kn-params`
unstyled (intentional — they reference these scopes only by virtue of
being absent from the test's REQUIRED_SCOPES_FIRST_PARTY list, which
reflects the dispatch's "most-visible" prioritisation).

These five scopes ARE in the dispatch's full §C scope list, but the test
does not assert them. Themes may add per-scope rules in v0.1+ if user
feedback shows they're insufficiently differentiated.

### #3 — Font weight / italic encoding via tokens.json

`tokens.json` v0.0.1 only encodes colours. `font-weight: bold` and
`font-style: italic` are hardcoded in each theme's CSS. If
design-system consumers want to override the bold/italic defaults from
JS, a v0.1 token shape would add `effects` keys per scope (`comment:
{ italic: true }`, `keyword: { weight: 700 }`).

**Followup:** revisit when a Storybook integration or design-token sync
tool ships and concrete demand surfaces.

---

## Branch state

- Branch: `feat/themes-default` from `main` at `17c645c`.
- Logical commits (in order):
  1. **Workspace wiring + package skeleton** (tsconfig + vitest.shared
     entries; package.json/tsconfigs/scripts/empty styles).
  2. **CSS themes + compat shim** (the four CSS files + tokens.json).
  3. **Smoke tests + typed re-export** (tests + src/index.ts).
  4. **Build manifest + changeset.**
- Untracked at start: `node_modules/`, `dist/`, `bun.lock` (gitignored
  except `bun.lock`).

---

**STATUS: DONE.** All 5 acceptance gates pass. All 8 verification
commands pass. 118 new tests; workspace total 235 → 353. The package
ships first-party `dark`, `light`, `high-contrast` themes for the default
`kn-*` class prefix plus a `compat-hljs.css` variable-mapping shim for
users transitioning from third-party `hljs-*` themes — exactly as
specified in spec §1.2 / §5.3 / §7.4.
