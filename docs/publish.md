# Publishing kindly-note to npm

The `@kindly-note` organization is reserved on npm. v0.1.0 is publish-ready.

This runbook documents the exact sequence to publish.

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

## Lessons from the v0.1.0 rehearsal (caught and fixed before real publish)

1. **License templating bug** — all 13 packages had `"license": "BSD-3-Clause"` while the root LICENSE is MIT. Fixed; all now say MIT.

2. **`workspace:*` in published tarballs** — Changesets did NOT rewrite `workspace:*` specifiers at publish time despite its docs saying it should. Fix: use `^X.Y.Z` directly in source `package.json` for `@kindly-note/*` internal deps. Bun workspaces still resolve concrete ranges to local packages, so dev workflow is unchanged.

   *If you ever see `Unsupported URL Type "workspace:"` from a consumer's npm install, this is the cause.*

3. **Hardcoded version assertions in tests** — `themes-default/tests/themes.test.ts` had `expect(pkg.version).toBe('0.0.1')` which broke after the version bump. Fix: `toMatch(/^\d+\.\d+\.\d+/)`. Apply this convention to any future package-shape test.

4. **Changesets `minor` on `0.0.x` may produce `1.0.0`** — three packages bumped to 1.0.0 instead of 0.1.0 on a `minor` changeset; cause unclear. Fix was manual correction. Worth checking the bumped versions every time and overriding if anomalous.

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
