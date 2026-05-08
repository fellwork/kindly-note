# director-notes — kindly-note modernize track

> Append-only log. Each entry: date, round, on-thesis assessment, routing, priority, scope signal, refined brief for next researcher, surface-to-user triggers, continuity check.

## Round 1 — 2026-05-08 — Director: opening direction

### On-thesis assessment of Scout findings

- **§1 Public API surface** — DECISIVE. The "everything hangs off a default singleton" pattern is the central thing kindly-note is rejecting; the verbatim `PublicApi` enumerates exactly the do-not-break surface area. Lock into topic-summary as the migration target list.
- **§2 Plugin contract** — DECISIVE. `before:highlight` mutating a shared `context` and `after:highlight` mutating `result.value` is the load-bearing legacy behavior. The legacy adapter must reproduce mutation semantics; the modern protocol must NOT. This is the keystone constraint for Architect.
- **§3 Language definition format** — DECISIVE, with a sub-keystone in §3 Example B (TypeScript). The `tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR)` finding is the worst aggregate-hidden item: it is not "languages share helpers" — it is "TypeScript depends on JavaScript's *internal mutable arrays* as a runtime contract." This single sample is the hardest decomposition problem in the entire port.
- **§4 Mode-tree compilation** — DECISIVE for one reason: the `compileMode` mutates the raw definition object via `mode.isCompiled = true`. This blocks "language packages export pre-compiled definitions" without a redesign. Architect must answer compilation timing.
- **§5 Emitter contract** — DECISIVE. Already partially pluggable via `__emitter`, but with `__addSublanguage(emitter, subLanguageName)` leaking `DataNode.root` access. This is the single biggest opportunity: a clean `EmitterFactory` is small surface, big leverage.
- **§6 Auto-detect** — CONFIRMATORY. Confirms scope decision (auto-detect can be a separate package); the closure-coupling is mechanical, not architectural. Ack but don't dwell.
- **§7 Build pipeline** — GAP (Scout under-reached, gap-fill in flight). What's there is sufficient to know upstream Rollup is internal-only and there's no `exports` map. Architect can proceed.
- **§8 Internal coupling map** — DECISIVE. Cat 1 (`fsharp.js`/`nsis.js` → `../lib/regex.js`), Cat 2 (`typescript→javascript`, `arduino→cpp`), Cat 3 (ECMAScript / CSS shared libs), and Cat 5 (`exports` field) collectively define the four levels of inter-package dependency Architect must legislate.
- **§9 Tree-shake pain** — CONFIRMATORY. Validates the kindly-note thesis. Pain points 4 and 5 (`registerLanguage` as side effect, MODES as singleton properties) are the two structural patterns that *must* be replaced — not negotiated.
- **§10 Test inventory** — GAP (Scout BLOCKED claim disputed by Team Lead; gap-fill in flight). 1330 test files exist on disk; reconstructed-from-docs estimates are not actionable.
- **§11 Do-not-break list** — DECISIVE. Becomes the topic-summary `Do-not-break list` verbatim. Architect spec must show how each item maps to a kindly-note construct.
- **§12 Open questions** — DECISIVE as a routing list. Each of the 12 questions assigns to a specific Architect spec section (see brief).

### Routing for synthesis

I am collapsing Synthesizer into this Director pass and writing the topic-summary edits directly. Specifically:

1. **topic-summary §Open-design-questions:** add a 13th question — *"Compilation timing: are language packages distributed as raw `LanguageDefinition` factories (compiled at register time, mutating definition) or as pre-compiled `CompiledLanguage` artifacts (immutable, larger payload, faster cold-start)?"* — derived from Scout §4.
2. **topic-summary §Target-architecture: ADD a new subsection "Coupling debt to break"** enumerating the four coupling categories from Scout §8 with the policy each requires.
3. **topic-summary §Target-architecture: ADD a sub-bullet "Shared language helpers"** noting that ECMAScript/CSS/Java/Mathematica shared libs need their own `@kindly-note/lang-helpers-*` packages (or inlining policy).
4. **topic-summary §Do-not-break list:** populate from Scout §11 verbatim (this was the placeholder Scout was meant to fill).
5. **topic-summary §Why-this-exists:** add a 6th pain point — *"Inter-language inheritance via mutating exported internal arrays (TypeScript reaches into JavaScript's `exports.PARAMS_CONTAINS`)"* — this is the worst-of-the-bunch finding and deserves top billing.

### Round-1 priority

**Architect must produce a package-decomposition spec where the boundary between `@kindly-note/lang-typescript` and `@kindly-note/lang-javascript` is solved cleanly**, because that single boundary stress-tests the plugin protocol, the emitter abstraction, the compilation timing, and the typed-extension story all at once. If TS/JS works, the rest fall out.

### Scope signal

**CONTINUE-ON-THESIS.** Scout uncovered nothing that contradicts a locked decision. The TS/JS coupling is hard but solvable inside "clean-break modern API"; auto-detect cost is real but addressable in a downstream package; no licensing/legal/upstream-architectural surprise. Proceed to Architect.

### Refined brief for Architect (round 2 researcher)

**Deliverable:** `C:\git\kindly-note\docs\plan\architect-spec.md` — the kindly-note v0 architecture specification. ~6-12k words. Authored as the document that, if approved, becomes the contract for every Builder dispatch.

**Required sections (all mandatory):**

1. **Package decomposition.** Named monorepo packages, one per row, in a table: `name | purpose-in-one-sentence | public exports | dependency rules | one runnable usage example`. Required packages at minimum: `@kindly-note/core`, `@kindly-note/lang-helpers` (the standalone module home for `COMMENT`/`C_NUMBER_MODE`/etc. — Scout §9 pain point 5 demands this), `@kindly-note/lang-<n>` for at least JSON/JavaScript/TypeScript/Arduino/F# (the five languages with the four distinct coupling patterns from Scout §8), `@kindly-note/lang-pack-ecmascript` (or equivalent shared-helper resolution), `@kindly-note/auto-detect`, `@kindly-note/emitters-html`, `@kindly-note/legacy-plugin-adapter`, `@kindly-note/browser` (the DOM functions split off per Scout §11 / Open Q10), and at least one `@kindly-note/loader-*` runtime adapter.

2. **Modern plugin protocol spec.** Typed. Answer: pure-function pipeline vs typed event emitter vs middleware? Async-aware (yes/no with reasoning)? Per-phase tree-shakability? Error isolation per plugin? **Trap to avoid (Scout §2):** do NOT propose a protocol where plugins receive and mutate a shared context object — that is the legacy footgun. Propose either (a) pure transform functions returning a new value, or (b) scoped event emitters where mutation is explicit via API calls, not shared-object access. State which and why.

3. **Legacy-plugin adapter design.** Show concretely how each of the six legacy hooks (`before:highlight`, `after:highlight`, `before:highlightElement`, `after:highlightElement`, plus the two deprecated `*:highlightBlock`) maps onto the modern protocol. Include the mutation-shim — Scout §2 shows `before:highlight` plugins replace `context.code`/`context.language`/`context.result`; the adapter MUST faithfully accept these in-place mutations. Show one worked example: `highlightjs-line-numbers` (an `after:highlight` plugin that rewrites `result.value`).

4. **Language pack delivery strategy across all 4 runtimes.** Browser, Node, Deno/Bun, Workers/Edge — for each: how is a language loaded on demand? Dynamic `import()` works in three; Workers needs a fetch-based loader. Specify the loader interface. **Trap to avoid (scope decision):** no Node built-ins, no filesystem language loaders.

5. **Emitter abstraction design.** Stable typed `EmitterFactory` interface. Specify: what does the engine call (`startScope`/`endScope`/`addText`/`addSubLanguage`/`finalize`/`render` — note `render` not `toHTML`, since AST emitters don't return HTML)? What does `addSubLanguage` receive — a sub-emitter instance, or a typed token-tree value? **Trap to avoid (Scout §5):** the current `__addSublanguage(emitter, name)` leaks the consumer's internal `root` — design a contract that does not require the parent emitter to know the child's internal shape. Spec at minimum: `@kindly-note/emitters-html` (string), `@kindly-note/emitters-hast` (unified/rehype interop), `@kindly-note/emitters-ast` (raw token tree).

6. **Build-pipeline recommendation.** tsup vs unbuild vs tshy vs Rollup directly. State the choice and why; affects DX of contributors. Required: `"exports"` map per package, ESM-only, source-map policy, declaration emission. Note the gap-fill on Scout §7 may add color but should not change the Architect's answer.

7. **Migration-from-highlight.js story.** Two audiences: (a) end-users with existing `import hljs from 'highlight.js'` code, (b) plugin authors. For each, a `BEFORE → AFTER` snippet. The end-user migration must show how the do-not-break capability list (Scout §11) is reconstructed from kindly-note imports.

8. **Coupling-debt resolution table.** One row per Scout §8 category with the answer: Cat 1 (`fsharp→../lib/regex`) → policy; Cat 2 (`typescript→javascript`) → mechanism (and this is the keystone — pick one of: typed extension API, named exports from JS package, shared helper package, or composition via a new pattern); Cat 3 (shared lang libs) → policy; Cat 5 (`exports` field) → typed replacement.

9. **Compilation-timing decision.** Per Scout §4: is `LanguageDefinition` immutable and compiled into `CompiledLanguage` at register-time (or build-time)? Or is the legacy mutate-on-first-use pattern preserved? This is one decision; argue it and pick.

10. **Open-design-questions resolution.** Architect addresses each of the 13 open questions from `topic-summary.md` §Open-design-questions and assigns each to one of sections 1-9 above. No question may be left "deferred."

**Sample-based acceptance criteria (Architect's spec is INCOMPLETE if any fail):**
- For each named package: name, purpose-in-one-sentence, public exports, dependency rules, one runnable usage example. No package may have an empty cell.
- For the modern plugin protocol: at least one worked example with the actual function signatures a plugin author would write.
- For the emitter contract: a sequence diagram or numbered call-trace for `highlight('json', '{"a":1}')` showing every emitter method invoked, in order — analogous to Scout §5's "Concrete example" but in the new contract.
- For the legacy adapter: the worked `highlightjs-line-numbers` example must show end-to-end: registration call, hook invocation site, mutation of `result.value`, observable output.
- For the TS/JS coupling resolution: a worked code sample showing how `@kindly-note/lang-typescript` adds the decorator mode to JavaScript's parameter-list, in the chosen mechanism.

**Iron Law (adapted):** if any decision requires assuming behavior of upstream code Scout did not document (e.g., `cpp.js`'s exact import structure, the build-tool internals, or the `vuePlugin` injection mechanism), surface it as an explicit open question in the spec rather than guessing. The gap-fill Scout will land §7 (build pipeline) and §10 (tests) before Architect ships; Architect should consume those when they arrive but must not block on them for sections 1, 2, 3, 5, 8, 9.

**Open design questions Architect must address (assign each to a spec section):**
- Q1 plugin-protocol shape → §2
- Q2 language-definition format → §1 + §9
- Q3 emitter abstraction → §5
- Q4 auto-detect placement → §1 (package row for `@kindly-note/auto-detect`)
- Q5 theme delivery / CSS class compatibility → §7 migration story; spec must lock the `hljs-` prefix decision
- Q6 build pipeline → §6
- Q7 language pack delivery for runtimes → §4
- Q8 (new this round) compilation timing → §9
- Scout Q1 vuePlugin → §1 (out-of-scope or named package)
- Scout Q2 compilation caching → §9
- Scout Q3 inter-language exports → §8 Cat 5
- Scout Q4 before:highlight asymmetry with auto-detect → §2 (preserve, fix, or document)
- Scout Q5 emitter standardization → §5
- Scout Q6 supersetOf cross-package reference → §8
- Scout Q7 typed exports field → §8 Cat 5
- Scout Q8 scope-name compatibility → §7 (lock `hljs-` prefix to keep themes drop-in)
- Scout Q10 DOM dependency split → §1 (`@kindly-note/browser` package)
- Scout Q11 SAFE_MODE → §2 or §1 (typed `errorMode` option)
- Scout Q12 fsharp/nsis direct regex import → §8 Cat 1

### Surface-to-user triggers

**None — proceed.** No licensing concerns, no upstream choice that contradicts a locked decision, no breaking change the user would not have anticipated. The TS/JS coupling and the compilation-timing question are non-trivial but are squarely Architect's job to propose. The user has explicitly locked "clean-break modern API" — which authorizes Architect to redesign the plugin protocol and the language inheritance mechanism without further sign-off. User review gate is appropriately positioned AFTER Architect's spec lands, per the obligations in `state-modernize.md`.

## Round 2 — 2026-05-08 — Team-Lead verification (Director-r2 collapsed)

Architect's `architect-spec.md` STATUS: DONE. Team-Lead spot-verified the artifact rather than running a separate Director-r2 round (the dimensions Director-r1 demanded are all visibly present; an independent substance check has marginal value vs surfacing to the user-review gate immediately).

**Verification results:**

- **Self-audit accuracy:** §11 claims each of 7 locked user decisions is preserved AND each of 10 mandatory sections is filled. Spot-check confirms: `kn-` is default in §5.3 and §7.4; no `hljs-` default anywhere; no byte-fixture-compat caveats; Vitest+TS in §6.5; no node-builtin imports; no filesystem language loader; legacy adapter present at §3 with `highlightjs-line-numbers` worked example.
- **Keystone (Scout §8 Cat 2 / Open Q3):** §8.2 introduces `defineLanguage<T>({ extensible: T })` + `extendLanguage(parent, extensions)` — typed extension surface, parent deep-frozen, no array.push-into-parent. §8.2.1 worked example shows `JavaScriptExtensionPoints { PARAMS_CONTAINS, CLASS_REFERENCE }` typed exports. The worst-of-the-bunch finding has a typed answer.
- **Sample-based gates (Director-r1 acceptance criteria):** every package row in §1.2 has all 5 cells filled; plugin protocol in §2.6 has worked function signatures; emitter §5.6 has the 23-step call trace; legacy adapter §3.5 has the end-to-end `highlightjs-line-numbers` flow; TS/JS resolution §8.2.1+§8.2.2 has worked code.
- **No silent deferrals.** §12 (out-of-scope items) is small and each item has reasoning. Async plugin support is explicit v1+ deferral with cause cited (no current pull). Vue integration is explicit v1+ with cause cited.
- **Open-questions resolution (§10):** all 8 topic-summary + 12 Scout open questions assigned to a spec section with a one-line answer. None left "deferred."

**Scope signal:** **CONTINUE-ON-THESIS.** Spec is the contract; user-review gate is the appropriate next step. No surface-to-user trigger from substance — the surface is logistical (user is the review gate by design).

**Decisions in the spec the user may want to push back on (none are show-stoppers; all are reasonable defaults):**

- **Synchronous-only plugin protocol in v0** (§2.1). Justified by no current async pull; if the user wants async-from-day-one for grammar-fetch use cases, this is the one architectural reversal worth flagging.
- **`tsup` as the build pipeline** (§6.1). Reasonable; alternatives (unbuild, tshy, Rollup-direct) were considered. User may prefer a different DX baseline.
- **Five `lang-*` packages in v0 scope** (§1.2 rows for `json`, `javascript`, `typescript`, `arduino`, `fsharp`, `cpp`). Plus shared helpers. The remaining ~190 languages are deferred to a Builder cohort that ports them mechanically. User may want a different opening v0 cut.
- **No top-level `kindly-note` package** (§1.3). The unscoped name is reserved against squatting only.
- **`@kindly-note/themes-default`** (§1 last row + §5.3) ships a `kn-` → `hljs-` compat CSS layer. User may want to drop this shim since round-1 explicitly chose `kn-` as default; it's a 1-2 hour decision.

**Refined brief for next round (Builder cohort, pending user approval):** post-user-approval, the spec is decomposed into per-package Builder dispatches. Suggested ordering (by dependency depth):

1. `@kindly-note/core` (foundational; everything depends on it)
2. `@kindly-note/lang-helpers` + `@kindly-note/emitters-html` (in parallel — independent given core)
3. `@kindly-note/lang-pack-ecmascript`
4. `@kindly-note/lang-{json, javascript}` (parallel)
5. `@kindly-note/lang-typescript` (depends on lang-javascript — exercises the keystone first)
6. `@kindly-note/legacy-plugin-adapter` (depends on core; exercises plugin protocol)
7. `@kindly-note/auto-detect`, `@kindly-note/browser`, loaders (parallel)
8. `@kindly-note/themes-default`
9. `@kindly-note/lang-{cpp, arduino, fsharp}` (cover Cat 1 + Cat 2 patterns; once these work, port the other ~190)

This is a Director-r3 problem when we get there; no need to lock it now.

---

### User-checkpoint addendum — 2026-05-08

Three substance decisions confirmed by user before Architect dispatch:

1. **No byte-for-byte fixture compat** — emitter design is free; kindly-note generates fresh fixtures.
2. **`kn-` as default CSS class prefix** — clean brand; opt-in compat via `configure({classPrefix: 'hljs-'})`.
3. **Vitest + native TypeScript** as test stack.

**Implication for Architect §5 (emitter):** drop the "fixture-byte-compat option" trade-off — design for clarity and pluggability, not upstream class-ordering. Default emitter output is whatever produces the cleanest typed contract.

**Implication for Architect §1 (package decomposition):** add `@kindly-note/themes-default` (or `@kindly-note/theme-pack`) — a small first-party theme set covering at least dark + light + high-contrast.

**Implication for Architect §7 (migration story):** the migration table must show `hljs-keyword` → `kn-keyword` and provide a documented opt-in for users who want to keep their existing themes (`configure({classPrefix: 'hljs-'})`).

**Continuity check (re-stated):**

**Scout under-reached on §7 (build pipeline) and §10 (test inventory); gap-fill in flight per Team Lead.** Scout's "BLOCKED" claim on `test/` and `tools/build.js` was wrong — those files exist (1330 test files, 101-line `build.js`). Future rounds should not trust this Scout's BLOCKED/PARTIAL claims at face value; verify with `Glob`/`Read` first. Beyond §7/§10, the only finding Architect will need that Scout did not provide is the actual `tools/build.js` plugin-list mechanism (how the build tool decides which languages bundle into `lib/common.js`); the gap-fill should cover this. If gap-fill comes back thin on test-shape (fixture file format, helper-function names), Architect can defer test-harness design to a Builder-time concern — it does not block the architectural spec.
