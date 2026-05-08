# @kindly-note/lang-javascript

The JavaScript / JSX / MJS / CJS language definition for
[kindly-note](https://github.com/srmcguirt/kindly-note). Default-exports a
deep-frozen `LanguageDefinition` and publishes a typed
`JavaScriptExtensionPoints` surface so downstream packages (notably
`@kindly-note/lang-typescript`) can compose new languages without mutating
JavaScript's internals.

This package is the **keystone** of the language-extension story laid out in
[`architect-spec.md` §8.2](../../docs/plan/architect-spec.md): a parent that
exposes a typed extension contract, consumed by descendants through the
`extendLanguage()` API rather than through array-mutation of an untyped
`exports: any` field.

## Install

```sh
npm install @kindly-note/core @kindly-note/lang-javascript
# or: bun add / pnpm add / yarn add
```

`@kindly-note/core` is a peer-style runtime dependency — bring your own
version. `lang-helpers` and `lang-pack-ecmascript` are workspace
dependencies of this package and resolve transitively.

## Usage

```ts
import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';

const hl = createHighlighter({ languages: [javascript] });
hl.highlight('const x = 1;', { language: 'javascript' }).value;
// → '<span class="kn-keyword">const</span> x = <span class="kn-number">1</span>;'
```

The default export is a deep-frozen `LanguageDefinition<JavaScriptExtensionPoints>`;
the matcher in `@kindly-note/core` compiles a fresh `CompiledLanguage` at
register time. Raw definitions are never mutated.

## Aliases

The language registers under all of these names:

- `js`
- `jsx`
- `mjs`
- `cjs`

Any of them work as the `language:` argument to `highlight()` and as the
`lang-…` className on `<pre><code>` blocks.

## Extension points

The `extensible` field on the `LanguageDefinition` publishes a typed
contract — the named export `JavaScriptExtensionPoints`:

```ts
export interface JavaScriptExtensionPoints {
  /** The contains-array used inside function-parameter parsing. */
  readonly PARAMS_CONTAINS: readonly Mode[];
  /** The mode that matches a class reference (e.g. `extends Foo`). */
  readonly CLASS_REFERENCE: Mode;
}
```

Downstream packages consume the contract through `extendLanguage()`. The
child supplies pure transforms — never mutations — for the points it cares
about. The parent stays frozen; the call returns a sibling
`LanguageDefinition`:

```ts
import { extendLanguage } from '@kindly-note/core';
import javascript, {
  type JavaScriptExtensionPoints,
} from '@kindly-note/lang-javascript';

const DECORATOR: Mode = { scope: 'meta', match: '@' + IDENT_RE };

const typescript = extendLanguage(javascript, {
  name: 'TypeScript',
  aliases: ['ts', 'tsx', 'mts', 'cts'],
  extendPoints: {
    PARAMS_CONTAINS: (current) => [...current, DECORATOR],
  },
  addContains: [
    DECORATOR,
    INTERFACE_MODE(javascript.extensible!), // closure over CLASS_REFERENCE
  ],
});
```

`@kindly-note/lang-typescript` is the canonical consumer of this surface; it
adds `DECORATOR` to `PARAMS_CONTAINS` and uses `CLASS_REFERENCE` inside its
`interface … extends Foo` mode. See
[`architect-spec.md` §8.2.2](../../docs/plan/architect-spec.md) for the full
worked example. Other future descendants (CoffeeScript, etc.) plug in the
same way.

Two structural guarantees are worth calling out:

- The extension surface is **typed**. `extendLanguage<JavaScriptExtensionPoints>`
  statically constrains `extendPoints` to `PARAMS_CONTAINS` and
  `CLASS_REFERENCE` — typos are caught by `tsc`.
- The extension is **non-mutating**. `PARAMS_CONTAINS` is `readonly Mode[]`;
  descendants compose with `(current) => [...current, …]` rather than
  `current.push(…)`.

## Status

`v0.0.1`. Cohort 4 (the keystone). Public API is minimal — a default export
plus the `JavaScriptExtensionPoints` type — and is governed by the
architect spec. Breaking changes before `1.0.0` are documented through the
repo's changeset workflow.

## License

BSD-3-Clause. See the repo root for the full text.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
