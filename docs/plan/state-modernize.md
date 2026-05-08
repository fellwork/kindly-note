# state — kindly-note (modernize highlight.js)

**Track:** `modernize`
**Topic:** Port highlight.js to a modern, tree-shakable, package-decomposed architecture under the `kindly-note` brand.
**Mode:** 2 — Build / refactor (L-scope), bootstrap session.
**Last updated:** 2026-05-08 — bootstrap.

## Current pointer

- **Phase:** 3 — Cohort 1 (`@kindly-note/core` + monorepo scaffolding) shipped. Branch `feat/scaffold-and-core` in worktree `C:\git\kindly-note\.claude\worktrees\agent-affd1c270346ff261`. 4 commits, 42/42 tests, all 5 Director gates green, all 6 verification commands clean, hard scope constraints (no node-builtins, no `hljs-` defaults) verified.
- **Active artifact:** `docs/plan/build-manifest-c1.md` — 6 documented open questions (none silent), full export inventory, verification log.
- **Next agent (pending user approval):** Builder cohort 2 — most-natural decomposition is `@kindly-note/lang-helpers` + `@kindly-note/emitters-html` in parallel (both depend only on core types, no shared state).

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

## Open obligations

- [x] Scout upstream highlight.js
- [x] Scout gap-fill §7/§10
- [x] Topic Director sets first-round substance direction
- [x] **User checkpoint** — confirmed: no byte-for-byte fixture compat; `kn-` as default CSS prefix; Vitest+TS test stack; proceed to Architect with full brief
- [x] Architect drafts package decomposition + plugin protocol spec (81KB, 10,250 words, self-audit clean)
- [x] **User review gate** — round 2.5 build-pipeline override applied (tsup→rolldown, pnpm→bun); spec approved
- [x] **Builder cohort 1** — `@kindly-note/core` + monorepo scaffolding shipped to `feat/scaffold-and-core`
- [ ] Decision: commit `docs/plan/*.md` to `main` so future Builder worktrees see it durably (currently untracked on both main and the feature branch)
- [ ] Decision: merge `feat/scaffold-and-core` to `main` (4 commits, no conflicts since `main` was clean)
- [ ] Builder cohort 2 — `@kindly-note/lang-helpers` + `@kindly-note/emitters-html` (parallel; both depend only on core types)
- [ ] Builder cohort 3 — matcher deepening (per cohort 1 open question #6) + `@kindly-note/lang-pack-ecmascript`
- [ ] Builder cohort 4 — `@kindly-note/lang-json` (smallest language; first real exercise of the deepened matcher)
- [ ] Builder cohort 5 — `@kindly-note/lang-javascript` + `@kindly-note/lang-typescript` (the keystone end-to-end proof point)

## Lessons captured this session

- **Lesson #2 reinforced:** `feature-dev:code-explorer` has no Write tool — it cannot produce file artifacts despite being a "code explorer." For any agent expected to produce a file deliverable, use `general-purpose` (or verify the agent's tool list before dispatch).
- **STATUS verification:** Scout reported PARTIAL claiming `test/` and `tools/build.js` were inaccessible. Both were trivially readable (1330 test files, 101-line build.js). Always verify BLOCKED claims against the filesystem; under-reach is a real failure mode.
- **User-overrides are surgical.** Round 2.5 (build pipeline) was an 8-edit targeted patch — far cheaper than re-dispatching Architect. Rule: if the user's override is a localized substance change (named tools, named values, single section), Team Lead applies it directly with edit precision; only re-dispatch a researcher when the override cascades into other sections.
