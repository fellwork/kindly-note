// Smoke tests for `@kindly-note/themes-default`.
//
// Per dispatch §E (acceptance gates), the package must:
//   1. Provide three theme CSS files + a compat-hljs CSS file, all parsing
//      and containing the required `kn-*` selectors.
//   2. Ship no JavaScript in the published surface (CSS-only). The TS file
//      in `src/` is a typed re-export of `tokens.json` — no runtime logic.
//   3. Have a `package.json#exports` map covering all four CSS subpaths
//      and `tokens.json`.
//   4. Have `tokens.json` importable as JSON.
//
// These tests read the source CSS via `node:fs` and assert that every
// scope from spec §C is targeted by at least one selector. We deliberately
// don't parse the CSS — we grep for selector tokens. The point is to
// catch "I forgot to add `kn-doctag`" regressions, not to typecheck CSS.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = resolve(here, '..', 'styles');
const pkgRoot = resolve(here, '..');

const readStyle = (name: string) => readFileSync(resolve(stylesDir, name), 'utf8');

// Required scopes per dispatch §C — at least these `kn-*` classes must
// appear in each of the three first-party themes (dark / light /
// high-contrast). Some scopes may be unstyled (inheriting fg) but they
// must AT LEAST appear as a selector somewhere — even with only a
// `font-weight` or `font-style` rule — so themes can be validated against
// the canonical scope list.
//
// Note that `kn-class_` is the tier-suffix expansion of `class.title`
// (spec §5.3). `kn-language_` is a tier-suffix too. These are matched as
// substrings; the tier-suffix `_` is part of the class name.
const REQUIRED_SCOPES_FIRST_PARTY = [
  'kn-keyword',
  'kn-built_in',
  'kn-type',
  'kn-string',
  'kn-number',
  'kn-literal',
  'kn-comment',
  'kn-doctag',
  'kn-title',
  'kn-class_',
  'kn-function',
  'kn-variable',
  'kn-attr',
  'kn-attribute',
  'kn-tag',
  'kn-name',
  'kn-selector-tag',
  'kn-meta',
  'kn-deletion',
  'kn-addition',
  'kn-bullet',
  'kn-strong',
  'kn-emphasis',
  'kn-link',
  'kn-quote',
  'kn-code',
  'kn-regexp',
  'kn-symbol',
] as const;

// compat-hljs.css doesn't aim for full scope coverage of the first-party
// list; it covers the most common ones a user transitioning from hljs-*
// would expect. This is the subset we require there.
const REQUIRED_SCOPES_COMPAT = [
  'kn-keyword',
  'kn-built_in',
  'kn-type',
  'kn-string',
  'kn-number',
  'kn-comment',
  'kn-title',
  'kn-attr',
  'kn-tag',
  'kn-meta',
  'kn-addition',
  'kn-deletion',
] as const;

describe('@kindly-note/themes-default — first-party themes', () => {
  for (const file of ['dark.css', 'light.css', 'high-contrast.css'] as const) {
    describe(file, () => {
      const css = readStyle(file);

      it('is non-empty and contains a `:root` block with custom properties', () => {
        expect(css.length).toBeGreaterThan(100);
        expect(css).toContain(':root');
        expect(css).toContain('--kn-bg');
        expect(css).toContain('--kn-fg');
      });

      it('contains a `.kn` rule that wires bg + fg + font', () => {
        // The .kn host element carries the surface colours — analogous to
        // upstream `.hljs { background: ...; color: ...; }`.
        expect(css).toMatch(/\.kn\s*\{/);
        expect(css).toContain('background:');
        expect(css).toContain('color:');
        expect(css).toContain('font-family:');
      });

      it.each(REQUIRED_SCOPES_FIRST_PARTY)('targets `.%s`', (scope) => {
        // `.kn-keyword`, `.kn-string`, etc. — the dot-prefixed selector
        // form. We allow the selector to appear anywhere in the file
        // (alone, in a list, with tier-suffix qualifiers).
        expect(css).toContain(`.${scope}`);
      });

      it('preserves the tier-suffix convention (spec §5.3)', () => {
        // Spec §5.3 / §7.4: `title.class.inherited` →
        // `kn-title class_ inherited__`. The tier-suffix selector
        // `.kn-title.class_` MUST appear so that span carrying both
        // classes (a single multi-class span emitted by the HTML
        // emitter) gets the title-class colour.
        expect(css).toMatch(/\.kn-title\.class_/);
      });

      it('does not emit any `hljs-` selector', () => {
        // First-party themes target `kn-*` exclusively. `hljs-*` matching
        // is the job of compat-hljs.css.
        expect(css).not.toMatch(/\.hljs-[a-z]/);
      });
    });
  }
});

describe('@kindly-note/themes-default — compat-hljs.css', () => {
  const css = readStyle('compat-hljs.css');

  it('uses `var(--hljs-*-color, inherit)` to bridge user-defined hljs palettes', () => {
    // Per dispatch §D: Mode A maps user-defined `--hljs-*` custom
    // properties onto `kn-*` selectors. Both directions (the variable
    // reference and the inherit fallback) must appear.
    expect(css).toContain('var(--hljs-keyword-color, inherit)');
    expect(css).toContain('var(--hljs-string-color, inherit)');
    expect(css).toContain('var(--hljs-comment-color, inherit)');
  });

  it.each(REQUIRED_SCOPES_COMPAT)('targets `.%s`', (scope) => {
    expect(css).toContain(`.${scope}`);
  });

  it('preserves the tier-suffix convention (spec §5.3)', () => {
    expect(css).toMatch(/\.kn-title\.class_/);
  });
});

describe('@kindly-note/themes-default — package shape', () => {
  // Read package.json from the package root and verify the exports map.
  // Acceptance gate §E-4.
  const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    exports: Record<string, unknown>;
    files: string[];
  };

  it('package name + version', () => {
    expect(pkg.name).toBe('@kindly-note/themes-default');
    expect(pkg.version).toBe('0.0.1');
  });

  it('exports map contains all four CSS subpaths + tokens.json', () => {
    expect(pkg.exports).toHaveProperty('./dark.css');
    expect(pkg.exports).toHaveProperty('./light.css');
    expect(pkg.exports).toHaveProperty('./high-contrast.css');
    expect(pkg.exports).toHaveProperty('./compat-hljs.css');
    expect(pkg.exports).toHaveProperty('./tokens.json');
  });

  it('exports map includes the JSON re-export at `.`', () => {
    // `import tokens from '@kindly-note/themes-default'` resolves to
    // `dist/index.js` (the typed token bundle).
    expect(pkg.exports).toHaveProperty('.');
  });

  it('files field includes dist + styles + src', () => {
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('styles');
    expect(pkg.files).toContain('src');
  });
});

describe('@kindly-note/themes-default — tokens.json', () => {
  // Acceptance gate §E-5: tokens.json importable as JSON.
  const tokens = JSON.parse(readFileSync(resolve(pkgRoot, 'src', 'tokens.json'), 'utf8')) as {
    version: string;
    themes: Record<string, { name: string; palette: Record<string, string> }>;
    fonts: { mono: string };
  };

  it('has version + three themes + fonts', () => {
    expect(tokens.version).toBe('0.0.1');
    expect(Object.keys(tokens.themes).sort()).toEqual(['dark', 'high-contrast', 'light']);
    expect(typeof tokens.fonts.mono).toBe('string');
  });

  it.each(['dark', 'light', 'high-contrast'] as const)(
    'theme `%s` has bg+fg+keyword+string',
    (k) => {
      const palette = tokens.themes[k]?.palette;
      expect(palette).toBeDefined();
      if (!palette) return;
      expect(palette.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.fg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.keyword).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.string).toMatch(/^#[0-9a-f]{6}$/i);
    },
  );
});
