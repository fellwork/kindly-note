# Publishing kindly-note to npm

The `@kindly-note` organization is reserved on npm. v0.1.0 is **published**. v0.2.0+ ships via the **GitHub release workflow** (`.github/workflows/release.yml`); manual publish is a fallback.

This runbook documents both paths.

---

## Automated path (recommended for v0.2.0+)

`.github/workflows/release.yml` runs on every push to `main`:

- **If pending changesets exist** (`.changeset/*.md`) — the workflow opens (or updates) a "Version Packages" PR that consumes the changesets, bumps versions, and regenerates `CHANGELOG.md` per package.
- **When that PR merges to main** — the workflow detects no pending changesets but versions ahead of npm, and **publishes**.

### One-time GitHub setup

1. **Generate an Automation-type npm token** at https://www.npmjs.com/settings/<your-username>/tokens.

   Settings → Access Tokens → Generate New Token → **Automation** (NOT "Publish" — Automation bypasses 2FA, which the workflow needs).

2. **Add the token to GitHub repo secrets**:

   Repo → Settings → Secrets and variables → Actions → New repository secret:
   - Name: `NPM_TOKEN`
   - Value: paste the token from step 1

3. **Verify org membership**: the npm account that generated the token must be a member of the `@kindly-note` org with publish rights. Check via `npm org ls kindly-note`.

After this, every PR that adds a changeset gets bundled into the next "Version Packages" PR; merging that publishes automatically.

---

## Manual fallback

If the workflow fails or you need a bespoke release:

---

## Pre-publish checklist (one-time)

Before the first publish, verify these are in order:

- [ ] You're logged in to npm with an account that's a member of the `@kindly-note` org. Check via `npm whoami` (returns your username if logged in).
- [ ] The org allows scoped public packages. (npm orgs default to private; toggle on the org settings page if needed.)
- [ ] Working tree is clean: `git status` shows nothing.
- [ ] All tests pass: `bun run test` is green.
- [ ] No leftover `.npmrc` at the repo root pointing to a non-real registry (the verdaccio rehearsal `.npmrc` was deleted; if you re-rehearse, delete it again before real publish).

---

## Publish sequence

```sh
# 1. Login (interactive — opens browser for npm web auth)
npm login --registry https://registry.npmjs.org/
# verify
npm whoami

# 2. Confirm what would publish
bun x changeset status

# 3. Publish all packages with pending versions
bun x changeset publish

# 4. Push the version tags Changesets created
git push --follow-tags
```

Step 3 publishes each package to npm. Each tarball is ~10-90 KB (see `docs/plan/state-modernize.md` for sizes). Total upload is ~300 KB across 13 packages.

After step 3, the packages are live at:

- https://www.npmjs.com/package/@kindly-note/core
- https://www.npmjs.com/package/@kindly-note/lang-helpers
- ... (etc., 13 total)

---

## Post-publish smoke test

In a sandbox directory:

```sh
mkdir /tmp/kindly-note-smoke && cd /tmp/kindly-note-smoke
npm init -y
npm install @kindly-note/core @kindly-note/lang-json @kindly-note/emitters-html

cat > smoke.mjs <<'EOF'
import { createHighlighter } from '@kindly-note/core';
import json from '@kindly-note/lang-json';
import { htmlEmitter } from '@kindly-note/emitters-html';

const hl = createHighlighter({ languages: [json], emitter: htmlEmitter });
const result = hl.highlight('{"a": 1, "b": "hi"}', { language: 'json' });
console.log(result.value);
EOF

node smoke.mjs
```

Expected output: HTML with `<span class="kn-attr">"a"</span>` etc. spans.

---

## Subsequent releases

For 0.1.1+ patches or 0.2.0+ minors:

1. Add a changeset for each change: `bun x changeset` (interactive)
2. Commit the changeset alongside the code change
3. When ready to release: `bun x changeset version` (consumes pending changesets, bumps versions)
4. Commit the version bumps + CHANGELOG updates
5. Publish: `bun x changeset publish`
6. Push: `git push --follow-tags`

---

## Lessons from the v0.1.0 rehearsal + first publish (caught + fixed)

1. **License templating bug** — all 13 packages had `"license": "BSD-3-Clause"` while the root LICENSE is MIT. Fixed; all now say MIT.

2. **`workspace:*` in published tarballs** — Changesets did NOT rewrite `workspace:*` specifiers at publish time despite its docs saying it should. Fix: use `^X.Y.Z` directly in source `package.json` for `@kindly-note/*` internal deps. Bun workspaces still resolve concrete ranges to local packages, so dev workflow is unchanged.

   *If you ever see `Unsupported URL Type "workspace:"` from a consumer's npm install, this is the cause.*

3. **Hardcoded version assertions in tests** — `themes-default/tests/themes.test.ts` had `expect(pkg.version).toBe('0.0.1')` which broke after the version bump. Fix: `toMatch(/^\d+\.\d+\.\d+/)`. Apply this convention to any future package-shape test.

4. **Changesets `minor` on `0.0.x` may produce `1.0.0`** — three packages bumped to 1.0.0 instead of 0.1.0 on a `minor` changeset; cause unclear. Fix was manual correction. Worth checking the bumped versions every time and overriding if anomalous.

5. **2FA blocks `changeset publish`** — first publish attempt failed `EOTP` for every package. Two solutions: pass `--otp=<code>` per command (tight 30s window), or use an **Automation token** from npm (bypasses 2FA — the path the GitHub release workflow takes).

6. **`npm install` 404 immediately after publish** — npm CLI's local cache stores 404s during the publish window. `npm cache clean --force` clears it. The version-specific URL (`/@scope/pkg/X.Y.Z`) propagates instantly; package-listing URL (`/@scope%2Fpkg`) takes minutes — useful signal when verifying.

---

## Rollback / unpublish

If something is wrong post-publish, you have a 72-hour window to unpublish:

```sh
npm unpublish @kindly-note/<package>@<version>
```

After 72 hours, npm only allows deprecation, not unpublish. Use:

```sh
npm deprecate @kindly-note/<package>@<version> "Replaced by 0.1.1"
```
