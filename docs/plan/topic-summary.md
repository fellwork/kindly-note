# topic-summary — kindly-note: modern highlight.js port

> Living document. Synthesizer updates after each Director routing. Researchers brief from this, not from raw prior findings.

## Mission

Reimplement highlight.js as **kindly-note**: a modern, ESM-only, tree-shakable, monorepo-of-small-packages syntax highlighting library with a typed plugin protocol and an adapter layer that wraps legacy highlight.js plugins.

## Why this exists (problem statement)

Upstream highlight.js carries 195+ language definitions, a CJS-and-ESM dual build, and a plugin model designed in 2019. Real-world pain:

1. **Bundle bloat in browser apps.** `import hljs from 'highlight.js'` pulls in everything; the "core + register" API is a workaround, not a tree-shake.
2. **Workers/Edge unfriendly.** Filesystem-style language loaders and dynamic `require` patterns don't survive bundlers targeting Workers.
3. **No first-class types for plugins.** The `before:*`/`after:*` hook system mutates a shared context object; plugin authors guess at the contract.
4. **Slow cold-start in serverless / edge.** Every language definition is a regex tree built at module-load.
5. **Coupled language definitions.** Languages share helpers via deep imports into core internals — hostile to tree-shaking.
6. **Inter-language inheritance via shared mutable state.** TypeScript depends on JavaScript by calling `javascript(hljs)` and then *mutating its returned `Language.exports.PARAMS_CONTAINS` array in-place* — an untyped runtime contract reaching into another language's private mode collection (Scout §3, §8 Cat 5). This is the worst single decomposition obstacle.

## Target architecture (proposed, pre-Scout)

A monorepo with these package categories:

| Category | Example packages | Role |
|---|---|---|
| **Core** | `@kindly-note/core` | Engine: matcher, mode-tree walker, emitter contract, types. Zero language data. |
| **Languages** | `@kindly-note/lang-typescript`, `@kindly-note/lang-rust`, … | One package per language. Each exports a `LanguageDefinition` and depends only on `@kindly-note/core/lang-helpers`. |
| **Bundles** | `@kindly-note/common`, `@kindly-note/web`, `@kindly-note/all` | Curated convenience bundles that re-export core + a language set. |
| **Themes** | `@kindly-note/theme-github`, … | CSS / token-based themes. Import in user's stylesheet pipeline. |
| **Plugins (modern)** | `@kindly-note/plugin-line-numbers`, … | Use the typed plugin protocol from core. |
| **Plugin adapter** | `@kindly-note/legacy-plugin-adapter` | Wraps highlight.js's `addPlugin({ 'before:highlight': fn, … })` shape over the modern protocol. |
| **Runtime adapters** | `@kindly-note/loader-import-map`, `@kindly-note/loader-fetch`, … | Optional: helpers for dynamic language loading per runtime. |

**Hard constraints (from scope decisions):**
- ESM-only. No CJS exports.
- `@kindly-note/core` has zero Node built-in dependencies.
- Language packages have zero shared runtime state — pure functions building static config.
- Plugin protocol is fully typed; legacy adapter is the only place untyped escape hatches live.
- Tree-shaking is the design objective, not a bonus: every public symbol must be importable in isolation.
- **Default CSS class prefix: `kn-`** (round-1 user decision). Upstream's `hljs-` is NOT preserved as default; users opt in via `configure({classPrefix: 'hljs-'})` if they want to reuse upstream themes verbatim. kindly-note ships its own theme set.
- **Fixture format is free.** Upstream's 534 markup fixtures are NOT a byte-for-byte regression bar (round-1 user decision). Architect designs emitter output for clarity/correctness; kindly-note generates its own fresh fixtures during the port.
- **Test stack: Vitest + native TypeScript** (round-1 user decision). All packages author tests in `*.test.ts`; happy-dom or jsdom for DOM-bearing packages.

**Coupling debt to break (per Scout §8):**
- **Cat 1 — Language → core internals by file path.** `fsharp.js` and `nsis.js` import `../lib/regex.js` directly. kindly-note must offer `@kindly-note/core/regex` (or equivalent) as a stable, typed, importable subpath OR forbid this pattern and require `hljs.regex` arg use. Architect picks.
- **Cat 2 — Language → language.** `typescript→javascript`, `arduino→cpp`, plus `pgsql.supersetOf="sql"`. Cross-package dependencies are unavoidable; the typed mechanism is a design call.
- **Cat 3 — Language shared libs.** `lib/ecmascript.js` (used by JS/TS/CoffeeScript/LiveScript/JSON), `lib/css-shared.js` (CSS family), `lib/java.js` (Java/Kotlin), `lib/kws_swift.js`, `lib/mathematica.js`. Each becomes a `@kindly-note/lang-helpers-<family>` package OR is inlined per language. Architect specifies policy.
- **Cat 5 — Untyped `Language.exports` field.** Used by TypeScript to access JavaScript's `PARAMS_CONTAINS` array. The modern protocol must replace this with a typed extension API or a shared-helper package.

**Shared language helpers:** ECMAScript, CSS, Java, Swift, Mathematica families each have shared mode helpers in `src/languages/lib/`. Each needs a delivery answer (own package, inlined, or core export) — see Cat 3 above.

## Open design questions (for Architect round)

1. **Plugin protocol shape.** Pure function pipeline vs typed event emitter vs middleware-style? Async-aware? Tree-shakable per phase?
2. **Language definition format.** Keep highlight.js's mode-tree shape (compatibility for ports) or design a new declarative IR?
3. **Emitter abstraction.** Single token-stream emitter vs pluggable (HTML, AST, JSON, hast for unified/remark)?
4. **Auto-detect.** Keep heuristic auto-language detection? If yes, where does it live (separate package?) since it requires loading multiple language definitions.
5. **Theme delivery.** CSS class names compatible with highlight.js classes (`.hljs-keyword`)? Or new namespace? Affects whether existing themes can be reused as-is.
6. **Build pipeline.** ✅ **RESOLVED (round-2 user override):** rolldown for build, bun for runtime+packages+workspace, Changesets for versioning, Biome for lint, Vitest for tests. See architect-spec §6.
7. **Language pack delivery for runtimes.** Dynamic import works for Node/browsers/Deno/Bun. For Workers, the bundler embeds dynamic imports — do we ship a fetch-based loader for runtime-loaded languages?
8. **Compilation timing.** Per Scout §4, upstream compiles a Language's mode tree on first `_highlight()` call by mutating `mode.isCompiled = true` on the raw definition. Are kindly-note language packages distributed as raw `LanguageDefinition` factories (compiled at register time, with mutation), as immutable factories (compiled into a separate `CompiledLanguage` artifact at register time), or as pre-compiled artifacts shipped from the language package itself? Affects payload size, cold-start cost, and whether `LanguageDefinition` can be `Object.freeze`'d.

## Do-not-break list (capability surface from Scout §11)

> We may break syntax, but every capability below MUST exist somewhere in kindly-note. Architect's spec must show, for each item, the kindly-note construct that carries the capability.

- **`highlight(code, {language})` returning `{value, relevance, illegal}`** — primary programmatic API; `value` is HTML with `<span class="hljs-*">` that all themes target.
- **Language registration by string name** — `registerLanguage(name, fn)` / `getLanguage(name)` / `listLanguages()`; the canonical lookup mechanism.
- **Language aliases** — `registerAliases(['ts','tsx'], {languageName:'typescript'})`; users specify language by alias in HTML class names.
- **`highlightAuto(code, subset?)` returning `{language, secondBest, value}`** — `secondBest` is used by editors for alternate suggestions.
- **`hljs.configure({classPrefix, cssSelector, ignoreUnescapedHTML})`** — `classPrefix` lets users namespace CSS classes; default `hljs-` must remain default to keep themes drop-in.
- **`addPlugin` / `removePlugin` with all 6 legacy hooks** — `before:highlight`, `after:highlight`, `before:highlightElement`, `after:highlightElement`, plus deprecated `*:highlightBlock`. Legacy adapter must accept these verbatim.
- **`before:highlight` context mutation** — plugins replace `context.code`, `context.language`, or short-circuit via `context.result`. Legacy adapter MUST faithfully accept in-place mutation; modern protocol must NOT have this footgun.
- **`after:highlight` result mutation** — plugins rewrite `result.value` (line-number injection works this way).
- **`highlightElement(el)` DOM API** — reads `textContent`, writes `innerHTML`, sets `el.dataset.highlighted`, `el.result`, `el.secondBest`.
- **`highlightAll()` auto-init** — scans `document.querySelectorAll('pre code')`, respects `options.cssSelector`.
- **`disableAutodetect: true` on language definitions** — opt-out of auto-detection.
- **`newInstance()` — isolated highlighter instances** — used by lowlight and unified/rehype for independent registries and plugin lists.
- **`subLanguage` — embedded language highlighting** — JS in HTML, CSS in JS tagged templates; engine recurses or calls `highlightAuto`.
- **`supersetOf` field** — auto-detect tie-breaker (C++ wins over Arduino on ties).
- **Scope-to-CSS-class tiered mapping** — `"title.class.inherited"` → `"hljs-title class_ inherited__"` with multiple space-separated classes. Existing themes depend on this verbatim mapping.
- **`hljs.regex` utilities** — `concat`, `lookahead`, `either`, `optional`, `anyNumberOfTimes`; third-party language definitions use these.
- **`compilerExtensions` on Language** — custom compilation passes; 1st-party today but the API exists.
- **`__emitTokens` escape hatch** — language bypasses regex engine and emits tokens directly. Planned stable in v12.
- **`SAFE_MODE` default-on error swallowing** — parse errors return escaped plaintext instead of throwing; users depend on no-crash default.
- **`versionString` property** — plugins/tooling check compatibility.

## Findings ledger

> Append-only. Researchers add their reports here. Synthesizer condenses into the sections above.

- **Round 1, Scout (2026-05-08):** `docs/plan/scout-report.md` — 12-section deep dive on highlight.js v11.11.1. Decisive findings absorbed into Why-this-exists, Target-architecture (Coupling debt subsection), Open-design-questions (added Q8 compilation timing), and Do-not-break list. Gap-fill in flight for §7 build pipeline and §10 test inventory.

## Director notes

> Append-only routing decisions. See `director-notes.md` for the full log.

- **Round 1 (2026-05-08):** Opening direction set; CONTINUE-ON-THESIS; refined brief for Architect drafted with TS/JS coupling resolution as the keystone deliverable. See `docs/plan/director-notes.md`.
