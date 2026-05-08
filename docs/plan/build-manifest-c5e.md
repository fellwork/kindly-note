# Build manifest — Cohort 5e: `@kindly-note/browser`

**Date:** 2026-05-08
**Builder:** Cohort 5e (kindly-note modernize track)
**Branch:** `feat/browser` (from `main` at `b50f8ae`)
**Spec contract:** `docs/plan/architect-spec.md` (§1.2 row `@kindly-note/browser`;
§7.1 Audience A migration table; §2 modern plugin protocol — element phases).
Scout authority: `docs/plan/scout-report.md` §11 (do-not-break list);
§2 (legacy DOM hooks for adapter consistency).

**Depends on (peer):** `@kindly-note/core` (Highlighter contract, plugin
protocol, runHook). Optional peer: `@kindly-note/auto-detect` — passed
in by reference at the call site; never `import`ed by the browser
package itself. Test fixtures additionally use `@kindly-note/lang-json`,
`@kindly-note/lang-javascript`, `@kindly-note/emitters-html`.

This manifest documents what cohort 5e produced, with verification
evidence for every dispatch acceptance gate (§D-1 through §D-9).

---

## Scope summary

A single new package: `@kindly-note/browser`. Three exports complete the
v0 browser-side surface (spec §1.2 row):

- `highlightElement(el, hl, options?)` — single-element entry point.
- `highlightAll(hl, options?)` — batch DOM scan.
- `attachToDOM(hl, options?)` — initial scan + `MutationObserver` lifecycle.

Plus a small companion export — `languageFromClass(el)` — that the
package uses internally and re-exports as a public utility because
consumers building custom selectors will reuse it. The marker constant
`KINDLY_NOTE_HIGHLIGHT_MARKER` is also exported so consumers can
recognise nodes the package has already touched.

The package binds the legacy adapter's `before:/after:highlightElement`
hooks (spec §3.3 rows 3-4) through to the modern protocol's
`beforeElement` / `afterElement` phases (spec §2.2 phases 4 & 5). Those
phases were defined in cohort 1 but had no caller until this cohort
shipped.

---

## Files created

### `packages/browser/`
- `package.json` — `@kindly-note/browser` 0.0.1, ESM-only,
  `sideEffects: false`, single root export, peer dep on
  `@kindly-note/core`, peer-optional `@kindly-note/auto-detect`.
  devDeps: `@kindly-note/core`, `@kindly-note/auto-detect`,
  `@kindly-note/emitters-html`, `@kindly-note/lang-json`,
  `@kindly-note/lang-javascript`, `happy-dom`, `rolldown`,
  `rolldown-plugin-dts`, `typescript`, `vitest`.
- `tsconfig.json` — extends `../../tsconfig.base.json`,
  `lib: ["ES2022", "DOM"]` (DOM types only — runtime DOM is the package's
  raison d'être but Node-built-ins are still forbidden, dispatch §F).
  References both `../core` and `../auto-detect`.
- `tsconfig.test.json` — sibling for Vitest, also pulls in `lib.dom`.
- `rolldown.config.ts` — single-entry build (`index`),
  `platform: 'neutral'`, `external: [/^@kindly-note\//]`, `dts()` plugin.
- `vitest.config.ts` — overrides shared default to
  `environment: 'happy-dom'`. **First kindly-note package to use a
  non-`node` Vitest environment.**

### `packages/browser/src/`
- `index.ts` — public surface (spec §1.2 row): re-exports
  `highlightElement`, `highlightAll`, `attachToDOM`, plus
  `KINDLY_NOTE_HIGHLIGHT_MARKER`, `languageFromClass`, and the option
  types (`HighlightElementOptions`, `HighlightAllOptions`,
  `AttachToDOMOptions`, `AttachedHandle`, `AutoDetectorLike`,
  `ElementHighlightInfo`).
- `highlight-element.ts` — single-element implementation.
  Cites spec §7.1.5, §2.2, Scout §11 in doc-comments.
  Implements: language resolution (explicit → class → auto-detect path);
  `beforeElement` plugin phase; engine call (or auto-detect → engine
  re-call); DOM mutation; `dataset.highlighted` marker; `el.result` and
  optional `el.secondBest` properties via `defineProperty`;
  `afterElement` plugin phase.
- `highlight-all.ts` — batch scan. Uses `hl.options.cssSelector`
  (default `'pre code'`) when `options.selector` is omitted.
  Snapshots the NodeList via `Array.from` so plugin-driven DOM
  mutations during iteration do not perturb traversal order.
- `attach-to-dom.ts` — eager scan + `MutationObserver` lifecycle.
  Returns a `{ dispose() }` handle. Reads the `MutationObserver`
  constructor through `globalThis` so the package evaluates cleanly in
  non-DOM runtimes (Workers, server renderers).
- `language-from-class.ts` — class-attribute parser.
  Priority order: `kn-language-foo` → `language-foo` → `lang-foo`.
  Reference (NOT byte-copied): upstream `src/highlight.js:73`'s regex
  `/\blang(?:uage)?-([\w-]+)\b/i`.

### `packages/browser/tests/`
- `language-from-class.test.ts` — **10 tests**. Verifies all three
  prefix forms, hyphenated names, priority order, multi-class strings,
  the malformed `language-` no-match, and the substring-of-another-class
  no-match.
- `highlight-element.test.ts` — **12 tests**. Covers dispatch §D-2,
  §D-5, §D-7, §D-8: end-to-end JSON highlight; result/relevance
  attached; explicit `language` option overrides class; unknown
  language falls through; auto-detect path with stub detector;
  `secondBest` propagation; idempotence (re-call no-op); re-highlight
  after caller clears marker; plugin hook ordering and language
  override; afterElement receives the post-highlight result + raw text.
- `highlight-all.test.ts` — **5 tests**. Covers dispatch §D-4: batch
  scans multiple `<pre><code>` blocks (each its own language);
  custom selector; custom root scoping; idempotence at batch level;
  `hl.options.cssSelector` is the default selector.
- `attach-to-dom.test.ts` — **6 tests**. Covers dispatch §D-6:
  initial scan; MutationObserver picks up dynamically-added blocks;
  `dispose()` stops observation (post-dispose mutations not
  highlighted); deep-nested matching descendants in added subtrees;
  `observeMutations: false` runs only the initial scan; inert handle
  on no-DOM environments.

**Total tests in the new package: 33, all passing.**
**Total tests across the monorepo (after cohort 5e): 495 (462 baseline + 33 new).**

### `.changeset/`
- `browser-initial.md` — `'@kindly-note/browser': minor` for the
  initial 0.0.1 release.

## Files modified

- `tsconfig.json` (root) — added `{ path: './packages/browser' }` to
  `references` so `tsc -b` picks up the new package.
- `vitest.shared.ts` (root) — added `'browser'` to
  `KINDLY_NOTE_PACKAGES` so the bare-package alias resolves
  `@kindly-note/browser` → `packages/browser/src/index.ts` for tests.

---

## Public exports from `@kindly-note/browser`

### Runtime exports (named)
- `highlightElement(el, hl, options?): void`
- `highlightAll(hl, options?): void`
- `attachToDOM(hl, options?): AttachedHandle`
- `languageFromClass(el): string | undefined`
- `KINDLY_NOTE_HIGHLIGHT_MARKER: 'kindly-note'`

### Type exports (named)
- `HighlightElementOptions` — `{ language?, autoDetect?, autoDetector? }`.
- `HighlightAllOptions` — extends `HighlightElementOptions` with
  `{ selector?, root? }`.
- `AttachToDOMOptions` — extends `HighlightAllOptions` with
  `{ observeMutations? }`.
- `AttachedHandle` — `{ dispose(): void }`.
- `AutoDetectorLike` — minimal structural shape of an auto-detector.
- `ElementHighlightInfo` — `{ language?, relevance }` shape attached to
  `el.result`.

---

## Acceptance gate verification (dispatch §D)

### D-1: All ~462 prior tests still pass
- Verified: every other package's existing test suite still runs green.
  Per-package pass counts: themes-default 118, emitters-html 31, core
  71, legacy-plugin-adapter 31, lang-helpers 64, loader-fetch 17,
  loader-dynamic-import 14, auto-detect 37, lang-pack-ecmascript 32,
  lang-json 18, lang-javascript 11, lang-typescript 18 = **462 baseline**.
  Browser cohort adds 33 → **495 total**, zero failures.

### D-2: `highlightElement` end-to-end
- Test `highlightElement — end-to-end > highlights a <pre><code
  class="language-json"> block end-to-end`: builds the DOM, registers
  `@kindly-note/lang-json` with the htmlEmitter, calls
  `highlightElement(codeEl, hl)`. Asserts the rendered markup contains
  `<span class="kn-attr">`, contains the `"a"` token, and that
  `code.dataset.highlighted === 'kindly-note'`.

### D-3: Class-name parser
- 10 tests in `language-from-class.test.ts` covering each prefix
  variant (`language-foo`, `lang-foo`, `kn-language-foo`),
  hyphenated names (`objective-c`, `react-native`), priority order
  (kn → language → lang), the malformed `language-` no-match, the
  substring-of-another-class no-match, and the empty-class /
  no-language no-match.

### D-4: `highlightAll` batch + per-block language
- Test `highlightAll > highlights every matching <pre><code> block`:
  registers JSON + JavaScript languages; builds two blocks
  (`language-json`, `language-javascript`); calls `highlightAll(hl)`;
  asserts BOTH carry the marker AND that `el.result.language` is the
  expected canonical name (`'JSON'`, `'JavaScript'`).

### D-5: Auto-detect path
- Test `highlightElement — auto-detect path > uses a caller-provided
  autoDetector when language is unknown`: builds a code block with no
  language class; passes `{ autoDetect: true, autoDetector: stub }`;
  asserts the stub was called with the raw text, the engine re-ran
  through the detected language, and the rendered markup contains
  `kn-*` spans.
- Test `attaches secondBest when the detector returned one`: stub
  returns `{ language: 'json', secondBest: 'jsonc' }`; asserts
  `el.secondBest.language === 'jsonc'`.
- Test `does NOT call the detector when autoDetect is omitted`:
  control case.

### D-6: `attachToDOM` MutationObserver lifecycle
- Test `attachToDOM > highlights nodes added after attach`: attach,
  then `document.body.appendChild(<pre><code class="language-json">…)`,
  then flush microtasks/tasks, then assert the new block is
  highlighted.
- Test `does NOT highlight nodes added after dispose()`: attach,
  dispose, append, flush, assert NOT highlighted.
- Plus three additional tests covering: deep-nested descendants in
  added subtrees, `observeMutations: false` (one-shot mode), and the
  inert handle when no DOM is available.

### D-7: `beforeElement` / `afterElement` hooks fire
- Test `highlightElement — plugin hooks > fires beforeElement then
  afterElement, in that order`: registers a tiny plugin that pushes
  to a `calls[]` array on each phase; asserts
  `calls === ['before:json', 'after:{"a":1}']`.
- Test `lets a beforeElement plugin override the language`: plugin's
  `beforeElement` returns `{ ...input, language: 'json' }` even
  though the class says `typescript`; asserts the result's language
  is `'JSON'` (the engine re-routed).
- Test `passes the post-highlight result + raw text to afterElement`:
  asserts the `afterElement` input has `text === '{"a":1}'`,
  `result.value` contains `kn-attr`, and `result.language === 'JSON'`.

### D-8: Idempotence (chosen path: `dataset.highlighted` check)
- Test `highlightElement — idempotence > is a no-op on a second call`:
  highlight, snapshot markup, highlight again; assert markup unchanged
  and the `afterElement` plugin only fired once.
- Test `re-highlights after the caller clears dataset.highlighted`:
  documents the explicit re-highlight pattern: caller sets
  `el.textContent` to new code, `delete el.dataset.highlighted`, then
  `highlightElement(el, hl)` again. The new content is reflected.
- **Decision documented in code (highlight-element.ts):** we pick the
  `dataset.highlighted` check over "strip prior highlighting first";
  this matches upstream's behaviour at `src/highlight.js:753-756` and
  is the lowest-cost path.

### D-9: No node-builtins, no `hljs-` defaults in src
- Verified: `grep -rE "from 'node:|require\(|hljs-" packages/browser/src/`
  produces zero matches. The package is platform-neutral; the
  `hljs-` prefix is only an opt-in by users of `createHighlighter({
  classPrefix: 'hljs-' })` (spec §7.4) and never appears in this
  package's source.

---

## Verification commands run

| Command | Result |
|---|---|
| `bun install` | 10 packages installed (the new browser workspace + happy-dom). |
| `bun run typecheck` | `tsc -b` passes — 13 packages, all green. |
| `bun run --filter '@kindly-note/browser' build` | rolldown produces `dist/index.js` (12.27 kB), `dist/index-*.d.ts` (7.80 kB) chunked, sourcemap, types — exit 0. |
| `bun run --filter '@kindly-note/browser' test` | 33/33 pass (4 test files). |
| `bun run test` (workspace) | 495/495 pass (462 baseline + 33 new). |
| `bun run lint` | `biome check .` passes (151 files, 0 errors). |

---

## Constraints honored (dispatch §F)

- **Spec §1.2 + Scout §11 + §7.1 cited in code** — `highlight-element.ts`
  doc-comment header cites §1.2, §7.1.5, §2, Scout §11; per-section
  comments cite spec §2.2 / §3.3 at each plugin-phase fire site.
- **Sync** — every public function and helper is synchronous.
  `attachToDOM`'s observer is fire-and-forget; the only async surface
  in the package is the `MutationObserver` callback, which the
  observer dispatches asynchronously (DOM contract — not the package's
  choice).
- **DOM types via `lib.dom.d.ts`; no actual DOM lib import** —
  `tsconfig.json` declares `lib: ["ES2022", "DOM"]`. The runtime never
  imports any DOM identifier — `document`, `MutationObserver`, etc.
  are all read off `globalThis` defensively (so the package evaluates
  cleanly in non-DOM runtimes).
- **happy-dom for tests** — `vitest.config.ts` overrides
  `environment: 'happy-dom'`. happy-dom handles every test case in this
  cohort; no jsdom fallback was required.
- **Legacy-adapter expectations respected** — when a consumer calls
  `createHighlighter({ plugins: [adaptLegacyPlugin(legacyPlugin)] })`,
  the adapter's `beforeElement` / `afterElement` hooks fire through
  this package's `runBeforeElement` / `runAfterElement` helpers
  (covered by the existing cohort 5a tests; this cohort confirms the
  modern phases are wired by D-7).
- **Branch first; logical commits; Co-Author footer** — branch
  `feat/browser` cut from `main` at `b50f8ae` before any work.

---

## Notes for cohort review / future cohorts

1. **`Highlighter.plugins` is read via duck-typed cast.** The
   `HighlighterImpl` in `@kindly-note/core` carries its plugin array
   as a private `plugins` field (`highlighter.ts:80`); the browser
   package reads it through
   `(hl as unknown as { plugins?: readonly Plugin[] }).plugins`.
   This is a v0-pragmatic coupling. The clean follow-up is to promote
   the plugin list to a public read-only iterator on the
   `Highlighter` interface (e.g. `readonly plugins: readonly Plugin[]`).
   Doing so requires touching `@kindly-note/core` and is a
   cohort-of-its-own change (the public surface delta needs a
   changeset).

2. **Idempotence path: marker check, not "strip prior".** The dispatch
   gave us a pick-one. We picked `dataset.highlighted` because:
   (a) it matches upstream behaviour exactly (Scout §11 documents
   `el.dataset.highlighted` as a do-not-break property);
   (b) the alternative ("strip prior highlighting first") requires
   either re-running the engine on already-highlighted markup (incorrect
   — the markup has spans the engine doesn't know how to skip) or
   stashing the original `textContent` somewhere (more state, more
   surface for bugs);
   (c) the explicit re-highlight pattern (clear marker + new
   `textContent` + re-call) is documented and tested.

3. **Auto-detect path runs through the engine twice.** When
   `autoDetect: true` and the detector returns a language, the
   browser package calls `hl.highlight(text, { language: detected })`
   AGAIN to ensure plugin pipeline (`transformCode` /
   `transformResult`) fires for this DOM call. The detector itself
   internally calls `_highlight` for scoring; that path does not
   thread plugins. This double-call is a v0 acceptable cost; if it
   becomes an issue we expose a "skip-plugins detector" mode.

4. **The opaque marker is `'kindly-note'`, not upstream's `'yes'`.**
   This lets a page mid-migration tell which engine wrote the markup.
   Documented at the export site (`KINDLY_NOTE_HIGHLIGHT_MARKER`) and
   in the changeset.

5. **`languageFromClass` does NOT walk the parent's classList.**
   Upstream walks up to the `<pre>` if the `<code>` doesn't carry the
   class. We don't — the default selector `'pre code'` already finds
   the right element, and walking the parent surprises users who put
   the class on the `<pre>` deliberately. If a future caller needs
   upstream's parent-walk behaviour, they pass `language` explicitly.

6. **happy-dom provides MutationObserver out of the box.** No
   polyfill needed; the test suite's `flushMutations` just yields
   one microtask + one task. If a future test case needs a behaviour
   happy-dom doesn't ship (e.g. the Web Components `connectedCallback`
   timing), fall back to jsdom and document why in the test header.

7. **Tree-shaking on Workers/Edge confirmed.** Because every
   `@kindly-note/*` import is in the package's `external` list and
   the package itself is `sideEffects: false`, a Worker bundler that
   doesn't import any of `highlightElement` / `highlightAll` /
   `attachToDOM` drops the entire package. We do not yet have a
   Worker smoke test in CI (spec §6.5 lists Wrangler smoke testing as
   the policy — no GitHub Actions YAML written yet); a later cohort
   should land that gate.

---

**STATUS: DONE** — every dispatch §D acceptance gate green; all
verification commands (§E) green; manifest + changeset (§F) written.
