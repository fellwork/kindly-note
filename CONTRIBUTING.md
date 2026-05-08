# Contributing to kindly-note

Thanks for your interest. This document covers the practical mechanics of contributing
to the monorepo. The architectural contract lives at `docs/plan/architect-spec.md` —
that is the source of truth for "what should this look like?" questions.

## Prerequisites

- [Bun](https://bun.sh) 1.3 or newer (the version in `package.json#packageManager` is the
  canonical pin for CI).
- A POSIX-compatible shell (bash, zsh, fish, or PowerShell 7+).

## Initial setup

```sh
git clone https://github.com/<your-org>/kindly-note
cd kindly-note
bun install
```

This installs all workspace dependencies and runs `husky` to install the git hooks (via the `prepare` script). After this:

- **`pre-commit`** runs `lint-staged` — Biome auto-formats and checks staged TypeScript / JSON / Markdown files. Fast (only touches what you edited).
- **`pre-push`** runs `bun run typecheck && bun run test` across the whole workspace. Slower (~10-15 s) but catches integration breaks before they hit CI.

Bypass hooks for a one-off (e.g. work-in-progress commit) with `git commit --no-verify` / `git push --no-verify`. Don't make this a habit — CI will catch what you skip.

## CI + release

`.github/workflows/ci.yml` runs on every PR and push to `main`: install → lint → typecheck → test → build. PRs can't merge red.

`.github/workflows/release.yml` is Changesets-driven:

1. Add a changeset with your PR: `bun x changeset` (interactive). Pick affected packages and the bump type (patch/minor/major). Commit the generated `.changeset/*.md` file.
2. After your PR merges to `main`, the release workflow opens a "Version Packages" PR that consumes pending changesets and bumps versions.
3. Merging the "Version Packages" PR publishes the new versions to npm via `NPM_TOKEN`.

See `docs/publish.md` for the full publish runbook (including the one-time `NPM_TOKEN` setup).

## Running tests, typecheck, lint, and build

From the repo root:

```sh
bun run typecheck                                # tsc -b across all project references
bun run lint                                     # Biome — both lint and format checks
bun run --filter '@kindly-note/core' test        # one package
bun run --filter '@kindly-note/core' build       # one package
bun run test                                     # all packages
bun run build                                    # all packages
```

Per-package commands run inside the package's directory and use the package's own scripts.

## Adding a package

1. Create `packages/<short-name>/` (e.g. `packages/lang-rust`).
2. Add a `package.json` with name `@kindly-note/<short-name>`, `type: "module"`, the
   standard `exports` map, and `sideEffects: false` for non-CSS packages (see
   `architect-spec.md` §6.3 for the template).
3. Add a `tsconfig.json` extending `../../tsconfig.base.json`, with `outDir: ./dist`,
   `rootDir: ./src`, and `references` to any sibling packages it depends on at the
   TypeScript level.
4. Add a `rolldown.config.ts` (the template lives in `architect-spec.md` §6.2).
5. Add the new package's tsconfig to the root `tsconfig.json#references` array so
   `tsc -b` picks it up.
6. Add a changeset describing the new package: `bunx changeset`.

## Adding a changeset

Every PR that changes a published `@kindly-note/*` package needs a changeset:

```sh
bunx changeset
```

Pick the affected packages, the semver bump type, and write a one-line summary that
makes sense in a CHANGELOG. Commit the generated `.changeset/<name>.md` alongside your
code changes.

PRs that only touch internal docs, the build pipeline, or non-published files do
**not** need a changeset.

## Code style

- Biome handles formatting and linting. Run `bun run format` to auto-fix anything
  Biome will flag.
- TypeScript: `verbatimModuleSyntax: true`. Use `import type { ... }` for type-only
  imports. The Biome `useImportType` rule will flag mismatches.
- ESM only. No CJS shims. No Node built-in imports inside `packages/core/src/**`
  (see `architect-spec.md` §1.2 — the engine is runtime-neutral).
- Cite the spec in non-trivial decisions. A comment like `// spec §8.2: parent
  never mutated` in code is encouraged.

## Commit and PR conventions

- Imperative-mood commit titles, ≤72 chars.
- Body explains the *why* and references the spec section it implements when relevant.
- One logical change per commit (e.g., scaffolding in one commit, types in another,
  runtime in a third). This is for review hygiene.
- PRs against `main`. CI must be green; type checking must pass; tests must pass;
  lint must be clean.

## Reporting bugs

File an issue with:
- Reproduction steps or a minimal failing test.
- Expected vs. actual behavior.
- The relevant spec section if you believe the bug is a spec-violation.

If you find a spec ambiguity rather than a code bug, open a discussion thread; the
spec is intentionally normative and we resolve ambiguities by amending it.
