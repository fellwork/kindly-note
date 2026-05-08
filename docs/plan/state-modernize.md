# state — kindly-note (modernize highlight.js)

**Track:** `modernize`
**Topic:** Port highlight.js to a modern, tree-shakable, package-decomposed architecture under the `kindly-note` brand.
**Mode:** 2 — Build / refactor (L-scope), bootstrap session.
**Last updated:** 2026-05-08 — bootstrap.

## Current pointer

- **Phase:** 4 — Cohort 2 (`lang-helpers` + `emitters-html`) merged to `main` in parallel. Workspace-wide: **137/137 tests, 3 packages, lint clean, typecheck clean.** Main is at `3718033` (10 commits total).
- **Active artifacts:** `docs/plan/build-manifest-c1.md`, `build-manifest-c2a.md`, `build-manifest-c2b.md` (cumulative 17 documented open questions; none silent).
- **Next:** Cohort 3 — matcher deepening (required by cohort-1 open question #6 before any `lang-*` package can ship a real grammar) + `@kindly-note/lang-pack-ecmascript` (shared helpers for JS family) + `@kindly-note/lang-json` (smallest real language; first end-to-end exercise of the deepened matcher).

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
- [ ] Builder cohort 3a — matcher deepening (in `@kindly-note/core`); patches `packages/core/src/internal/matcher.ts` to handle nested mode descent, end-mode handling, illegal-rule escalation
- [ ] Builder cohort 3b — `@kindly-note/lang-pack-ecmascript` + `@kindly-note/lang-json` (parallel after 3a; lang-pack-ecmascript no runtime deps; lang-json depends on it)
- [ ] Builder cohort 4 — `@kindly-note/lang-javascript` + `@kindly-note/lang-typescript` (the keystone end-to-end proof point)
- [ ] Bigger picture: ports for the remaining ~190 languages (mechanical Builder pass once the keystone proves out), `@kindly-note/legacy-plugin-adapter`, `@kindly-note/auto-detect`, `@kindly-note/browser`, loaders, themes
- [ ] Architect-spec touch-up: §5 `addSubLanguage` signature paraphrase fix (C2b finding)

## Lessons captured this session

- **Lesson #2 reinforced:** `feature-dev:code-explorer` has no Write tool — it cannot produce file artifacts despite being a "code explorer." For any agent expected to produce a file deliverable, use `general-purpose` (or verify the agent's tool list before dispatch).
- **STATUS verification:** Scout reported PARTIAL claiming `test/` and `tools/build.js` were inaccessible. Both were trivially readable (1330 test files, 101-line build.js). Always verify BLOCKED claims against the filesystem; under-reach is a real failure mode.
- **User-overrides are surgical.** Round 2.5 (build pipeline) was an 8-edit targeted patch — far cheaper than re-dispatching Architect. Rule: if the user's override is a localized substance change (named tools, named values, single section), Team Lead applies it directly with edit precision; only re-dispatch a researcher when the override cascades into other sections.
- **Spec paraphrase in dispatch briefs is dangerous.** Cohort-2 brief paraphrased `addSubLanguage(name, stream)` but core's actual signature is `(stream, language)`. Builder rightly deferred to canonical code, but only because the brief explicitly said "verify against `packages/core/src/emitter.ts` before designing." Future briefs SHALL include the same instruction whenever the spec is paraphrased OR copy spec/code text verbatim.
- **Cross-cutting infrastructure changes from Builders are valuable but require post-merge follow-through.** C2a added `.gitattributes` to fix Windows CRLF — but `.gitattributes` only affects future checkouts. After merge, working-tree files still had CRLF until `biome format --write` rewrote them. Future cohorts: any infrastructure addition that affects pre-existing files needs a renormalize step in the merge runbook.
- **Parallel Builder dispatch works** when file scope is fully disjoint. Cohorts 2a/2b had zero file-level overlap (different `packages/<name>/`), single conflict point (`tsconfig.json#references` array, single line each). Resolution at merge time was trivial. Validated for future parallel dispatches.
