# state — kindly-note (modernize highlight.js)

**Track:** `modernize`
**Topic:** Port highlight.js to a modern, tree-shakable, package-decomposed architecture under the `kindly-note` brand.
**Mode:** 2 — Build / refactor (L-scope), bootstrap session.
**Last updated:** 2026-05-08 — bootstrap.

## Current pointer

- **Phase:** 6 — Cohort 3b merged. **First end-to-end architectural validation passed: real JSON grammar parses cleanly through cohort 3a's deepened matcher.** Main at `1366dc3` (16 commits total). **201/201 tests, 5 packages, lint+typecheck clean.**
- **Active artifacts:** `build-manifest-c1.md`, `c2a`, `c2b`, `c3a`, `c3b` (cumulative 33 documented open questions; none silent).
- **Next:** Cohort 4 — **the KEYSTONE** — `@kindly-note/lang-javascript` + `@kindly-note/lang-typescript`. The TS-extends-JS coupling is the architectural bet of the whole project (spec §8.2 Cat 2). If this works, the spec is fully validated.

## Locked-in scope decisions (round 0)

| Decision | Choice | Implication |
|---|---|---|
| Project relationship | **Standalone fork / new package family** | Publish under `@kindly-note/*` (or similar). No upstream constraints. |
| Compatibility | **Clean-break modern API** | ESM-only, async-friendly. No legacy `hljs` global. No CJS surface. |
| Runtimes | **Browser + Node + Deno/Bun + Workers/Edge** (all first-class) | No Node built-ins in core. Language packs delivered via dynamic import / fetch. No filesystem language loaders. |
| Plugin scope | **Adapter for existing highlight.js plugins** | Wrap legacy `before:*` / `after:*` hook plugins so users keep using them. Modern plugin protocol designed alongside the adapter. |

## Iteration ledger

| Round | Mode | Researcher(s) | Outcome | Iter # |
|---|---|---|---|---|
| 0 | Bootstrap | — | Scope decisions captured | 0/5 |
| 1a | 2 | Scout (`feature-dev:code-explorer`) | scout-report.md, 12 sections; STATUS: PARTIAL (§7/§10 thin — false BLOCKED claim) | 1/5 |
| 1b | 2 | Scout gap-fill (`feature-dev:code-explorer`) | scout-report-gapfill.md, §7+§10 with file/test counts; STATUS: DONE | 1/5 |
| 1c | 2 | Topic Director (`general-purpose`) | director-notes.md round 1; topic-summary.md edits (5 substantive); CONTINUE-ON-THESIS; refined Architect brief (10 sections + 5 acceptance gates) | 1/5 |
| 2 | 2 | Architect (`general-purpose`) | architect-spec.md, 81KB / ~10,250 words; all 10 mandatory sections; 20 packages tabled; TS/JS keystone resolved via typed `extendLanguage` API; 23-step emitter call trace; STATUS: DONE; self-audit clean | 2/5 |
| 2.5 | — | Team Lead (build-pipeline override) | User round-2 decision: tsup → **rolldown**, pnpm → **bun**. 8 targeted edits to architect-spec §1.1, §6.1-§6.7, §10, §11. Changesets/Biome/Vitest unchanged. | 2/5 |
| 3 | 2 | Builder C1 (`general-purpose`, worktree-isolated) | `feat/scaffold-and-core` branch with 4 commits: monorepo scaffolding (bun workspaces, Biome, Changesets) + `@kindly-note/core` (11 source modules) + 5 test files (42 tests, all passing) + build-manifest-c1.md. STATUS: DONE; all 5 Director gates PASS; all 6 verification commands clean; hard scope constraints honored. | 3/5 |
| 3-verify | — | Team Lead (in-line audit) | Independent re-run: 42/42 tests pass; lint clean; no node-builtins / no `hljs-` defaults / no top-level side effects in `packages/core/src`. Keystone tests inspected — 8 distinct cases for `extendLanguage` including frozen-array runtime push assertion. Commit hygiene strong. Skipped separate Verifier dispatch (verification budget exhausted productively). | 3/5 |
| 4a | 2 | Builder C2a (`general-purpose`, worktree-isolated) | `feat/lang-helpers` (3 commits): `.gitattributes` + `@kindly-note/lang-helpers` (17 helpers + 7 regex constants, all deep-frozen) + manifest. 64/64 tests, 5 acceptance gates green. STATUS: DONE; 5 open questions surfaced (none silent). | 4/5 |
| 4b | 2 | Builder C2b (`general-purpose`, worktree-isolated) | `feat/emitters-html` (1 commit): `@kindly-note/emitters-html` (default `kn-` prefix, `htmlEmitterWith` for opt-in `hljs-`). 31/31 tests, 7 acceptance gates green. STATUS: DONE; 1 spec-paraphrase catch (dispatch said `addSubLanguage(name, stream)` but core defines `(stream, language)` — Builder rightly deferred to canonical). | 4/5 |
| 4-merge | — | Team Lead | FF-merged C2a; cherry-picked C2b (single commit, conflict on `tsconfig.json#references` and `bun.lock` resolved by combining both refs and regenerating lock). Renormalized EOL via `biome format --write` after merge to clear CRLF artifacts. Final main: 10 commits, 137/137 tests, lint+typecheck clean. | 4/5 |
| 5a | 2 | Builder C3a (`general-purpose`, worktree-isolated) | `feat/matcher-deepening` (3 commits): matcher.ts full rewrite (133→360 lines), new internal/multi-regex.ts (~140 lines), additive compile.ts (CompiledMode now includes `terminatorEnd`/`endSameAsBegin`/`caseInsensitive`/`beginPattern`/`endPattern`/`keywordPatternRe`), highlighter.ts wrapper for illegal+sub-language. 14 new matcher tests (56 total core, was 42). 10 acceptance gates green; 10 open questions surfaced (none silent). STATUS: DONE. | 5/5 |
| 5-amend | — | Team Lead (round-3 markdown) | User round-3 decision: kindly-note absorbs markdown rendering as v1+ scope. Architect-spec amendments: §1.5 (7-package round-3 expansion table), §13 (security defaults + dialect strategy + emitter contract extension + mdast shape), §10.4 (8 markdown open questions). topic-summary mission updated. | 5/5 |
| 5-merge | — | Team Lead | Harness consolidated 3a's worktree into main checkout (branch swap, not a separate worktree dir). Switched back to main, FF-merged feat/matcher-deepening (3 commits), deleted branch. Markdown spec edits survived as working-tree changes (Builder respected "leave them alone"); committed as `7527caf`. Final main: 13 commits, 151/151 tests, lint+typecheck clean. | 5/5 |
| 6 | 2 | Builder C3b (`general-purpose`, worktree-isolated) | `feat/cohort-3b` (3 commits): `@kindly-note/lang-pack-ecmascript` (32 tests) + `@kindly-note/lang-json` (18 tests). 50 new tests; total 201/201. STATUS: DONE; **no matcher gaps surfaced** — cohort 3a's deepened matcher correctly drives JSON's grammar end-to-end. 6 open questions surfaced (none silent). | 6 |
| 6-merge | — | Team Lead | FF-merged `feat/cohort-3b`. Discovered DX issue: lang-json depends on lang-pack-ecmascript's runtime export `EXTENDED_NUMBER_MODE` (first cross-package runtime import); workspace tests fail until `bun run build` runs because Bun resolves to `dist/index.js`. Resolved by running `bun run build` before `bun run test` once. Permanent fix (vitest `resolve.alias` so workspace packages resolve to `src/`) deferred to cohort 4 brief. | 6 |

## Open obligations

- [x] Scout upstream highlight.js
- [x] Scout gap-fill §7/§10
- [x] Topic Director sets first-round substance direction
- [x] **User checkpoint** — confirmed: no byte-for-byte fixture compat; `kn-` as default CSS prefix; Vitest+TS test stack; proceed to Architect with full brief
- [x] Architect drafts package decomposition + plugin protocol spec (81KB, 10,250 words, self-audit clean)
- [x] **User review gate** — round 2.5 build-pipeline override applied (tsup→rolldown, pnpm→bun); spec approved
- [x] **Builder cohort 1** — `@kindly-note/core` + monorepo scaffolding shipped to `feat/scaffold-and-core`, merged to main
- [x] Commit `docs/plan/*.md` to `main` (durable for future Builder worktrees)
- [x] Merge `feat/scaffold-and-core` to `main` (FF, clean)
- [x] **Builder cohort 2** — `@kindly-note/lang-helpers` + `@kindly-note/emitters-html` shipped in parallel and merged
- [x] Builder cohort 3a — matcher deepening (merged; 14 new tests; 10 surfaced questions documented in build-manifest-c3a.md)
- [x] Round-3 markdown scope expansion captured in spec (§1.5, §13, §10.4)
- [x] Architect-spec touch-up: §5/§10 prose cleanup (cohort 2.5)
- [x] Builder cohort 3b — `@kindly-note/lang-pack-ecmascript` + `@kindly-note/lang-json` shipped, merged. Matcher validated end-to-end on real JSON.
- [ ] Builder cohort 4 — `@kindly-note/lang-javascript` + `@kindly-note/lang-typescript` (the keystone end-to-end proof point). Brief should also add vitest `resolve.alias` config to fix workspace src-resolution (DX issue surfaced by 3b).
- [ ] Builder cohort 5+ — `legacy-plugin-adapter`, `auto-detect`, `browser`, loaders, `themes-default`
- [ ] V1+ markdown ring: `lang-markdown`, `lang-markdown-gfm`, `emitters-markdown`, `emitters-mdast`, `render-markdown`, `integrations-{marked,remark}` (after cohort-4 keystone)
- [ ] Long tail: ~190 language ports (mechanical, after keystone proves out)

## Lessons captured this session

- **Lesson #2 reinforced:** `feature-dev:code-explorer` has no Write tool — it cannot produce file artifacts despite being a "code explorer." For any agent expected to produce a file deliverable, use `general-purpose` (or verify the agent's tool list before dispatch).
- **STATUS verification:** Scout reported PARTIAL claiming `test/` and `tools/build.js` were inaccessible. Both were trivially readable (1330 test files, 101-line build.js). Always verify BLOCKED claims against the filesystem; under-reach is a real failure mode.
- **User-overrides are surgical.** Round 2.5 (build pipeline) was an 8-edit targeted patch — far cheaper than re-dispatching Architect. Rule: if the user's override is a localized substance change (named tools, named values, single section), Team Lead applies it directly with edit precision; only re-dispatch a researcher when the override cascades into other sections.
- **Spec paraphrase in dispatch briefs is dangerous.** Cohort-2 brief paraphrased `addSubLanguage(name, stream)` but core's actual signature is `(stream, language)`. Builder rightly deferred to canonical code, but only because the brief explicitly said "verify against `packages/core/src/emitter.ts` before designing." Future briefs SHALL include the same instruction whenever the spec is paraphrased OR copy spec/code text verbatim.
- **Cross-cutting infrastructure changes from Builders are valuable but require post-merge follow-through.** C2a added `.gitattributes` to fix Windows CRLF — but `.gitattributes` only affects future checkouts. After merge, working-tree files still had CRLF until `biome format --write` rewrote them. Future cohorts: any infrastructure addition that affects pre-existing files needs a renormalize step in the merge runbook.
- **Parallel Builder dispatch works** when file scope is fully disjoint. Cohorts 2a/2b had zero file-level overlap (different `packages/<name>/`), single conflict point (`tsconfig.json#references` array, single line each). Resolution at merge time was trivial. Validated for future parallel dispatches.
- **Workspace src-resolution is a real v0 DX issue.** lang-json (cohort 3b) was the first package to import a runtime value (not just a type) from another workspace package. Bun's workspace symlinks resolve via `package.json#main` → `dist/index.js`, so tests fail until a build runs. The permanent fix is vitest `resolve.alias` mapping `@kindly-note/*` to `packages/*/src/index.ts` (or a sibling-aware vite-tsconfig-paths plugin); cohort 4 will land this. Until then, run `bun run build` after merging any cohort that adds a package depended on by another package's tests.
- **Harness worktree consolidation is non-deterministic.** Cohort 3a's worktree was consolidated into the main checkout (branch swap on the main checkout itself); cohort 3b's worktree stayed separate. Both patterns work for FF-merge but require Team Lead awareness of which mode the harness chose. Detect via `git worktree list` and `git branch` after the agent completes.
