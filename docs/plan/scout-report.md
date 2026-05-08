# Scout Report — kindly-note: highlight.js v11.11.1 Deep Dive

**Generated:** 2026-05-08
**Source reference:** `C:\git\highlightjs-upstream\` (v11.11.1, shallow clone)
**Authored for:** Topic Director / Architect briefing

> **§7 (Build pipeline) and §10 (Test inventory) in this file are thin** — gap-fill is in [`scout-report-gapfill.md`](./scout-report-gapfill.md). Treat that file as authoritative for those two sections.

---

## Public API surface

### Top-level default export

The package's default export is a singleton `HLJSApi` instance created at module load time (`src/highlight.js:1044`):

```js
const highlight = HLJS({});
highlight.newInstance = () => HLJS({});
export default highlight;
```

All methods are attached via `Object.assign(hljs, { ... })` at `src/highlight.js:996-1015`. There is no named-export surface — everything hangs off the default object.

### Complete `PublicApi` interface (verbatim from `types/index.d.ts:31-63`)

```ts
interface PublicApi {
    highlight(code: string, options: HighlightOptions): HighlightResult
    /** @deprecated use `highlight(code, {language: ..., ignoreIllegals: ...})` */
    highlight(languageName: string, code: string, ignoreIllegals?: boolean): HighlightResult
    highlightAuto: (code: string, languageSubset?: string[]) => AutoHighlightResult
    highlightBlock: (element: HTMLElement) => void
    highlightElement: (element: HTMLElement) => void
    configure: (options: Partial<HLJSOptions>) => void
    initHighlighting: () => void
    initHighlightingOnLoad: () => void
    highlightAll: () => void
    registerLanguage: (languageName: string, language: LanguageFn) => void
    unregisterLanguage: (languageName: string) => void
    listLanguages: () => string[]
    registerAliases: (aliasList: string | string[], { languageName } : {languageName: string}) => void
    getLanguage: (languageName: string) => Language | undefined
    autoDetection: (languageName: string) => boolean
    inherit: <T>(original: T, ...args: Record<string, any>[]) => T
    addPlugin: (plugin: HLJSPlugin) => void
    removePlugin: (plugin: HLJSPlugin) => void
    debugMode: () => void
    safeMode: () => void
    versionString: string
    vuePlugin: () => VuePlugin
    regex: {
        concat: (...args: (RegExp | string)[]) => string,
        lookahead: (re: RegExp | string) => string,
        either: (...args: (RegExp | string)[] | [...(RegExp | string)[], RegexEitherOptions]) => string,
        optional: (re: RegExp | string) => string,
        anyNumberOfTimes: (re: RegExp | string) => string
    }
    newInstance: () => HLJSApi
}
```

### Complete `ModesAPI` interface (verbatim from `types/index.d.ts:65-91`)

```ts
interface ModesAPI {
    SHEBANG: (mode?: Partial<Mode> & {binary?: string | RegExp}) => Mode
    BACKSLASH_ESCAPE: Mode
    QUOTE_STRING_MODE: Mode
    APOS_STRING_MODE: Mode
    PHRASAL_WORDS_MODE: Mode
    COMMENT: (begin: string | RegExp, end: string | RegExp, modeOpts?: Mode | {}) => Mode
    C_LINE_COMMENT_MODE: Mode
    C_BLOCK_COMMENT_MODE: Mode
    HASH_COMMENT_MODE: Mode
    NUMBER_MODE: Mode
    C_NUMBER_MODE: Mode
    BINARY_NUMBER_MODE: Mode
    REGEXP_MODE: Mode
    TITLE_MODE: Mode
    UNDERSCORE_TITLE_MODE: Mode
    METHOD_GUARD: Mode
    END_SAME_AS_BEGIN: (mode: Mode) => Mode
    // built in regex
    IDENT_RE: string
    UNDERSCORE_IDENT_RE: string
    MATCH_NOTHING_RE: string
    NUMBER_RE: string
    C_NUMBER_RE: string
    BINARY_NUMBER_RE: string
    RE_STARTERS_RE: string
}
```

These helpers are defined in `src/lib/modes.js` and bulk-merged onto the hljs object at `src/highlight.js:1038`:
```js
Object.assign(hljs, MODES);
```

This means every language definition that calls `hljs.C_NUMBER_MODE` is coupling to the hljs singleton, not importing from a standalone module.

### Key return types (verbatim from `types/index.d.ts:96-118`)

```ts
export interface HighlightResult {
    code?: string
    relevance : number
    value : string
    language? : string
    illegal : boolean
    errorRaised? : Error
    secondBest? : Omit<HighlightResult, 'second_best'>
    _illegalBy? : illegalData
    _emitter : Emitter
    _top? : Language | CompiledMode
}

export interface HLJSOptions {
    noHighlightRe: RegExp
    languageDetectRe: RegExp
    classPrefix: string
    cssSelector: string
    languages?: string[]
    __emitter: EmitterConstructor
    ignoreUnescapedHTML?: boolean
    throwUnescapedHTML?: boolean
}
```

### Frequency of use in the wild

From the upstream README, in order of prominence:
1. `hljs.highlightAll()` — the one-liner browser entry point; most tutorials use only this
2. `hljs.highlight(code, {language})` — programmatic per-language highlight; server-side and framework integrations
3. `hljs.highlightElement(el)` — DOM-driven per-element highlight; used in manual-init patterns
4. `hljs.highlightAuto(code)` — language-detection entry point; used when language is unknown
5. `hljs.registerLanguage(name, fn)` — required whenever using the core-only import pattern
6. `hljs.configure(options)` — used to change `classPrefix`, `cssSelector`, emitter
7. `hljs.addPlugin(plugin)` — used by line-number plugins, copy-to-clipboard plugins
8. `hljs.newInstance()` — used by lowlight and unified/rehype ecosystem to get isolated instances

**`vuePlugin`** is declared in the types but absent from `src/highlight.js`. It is added as a build artifact by the build pipeline for specific targets. Its absence from the source clone means it cannot be traced here — flagged as an open question.

### `highlight.js/lib/core` entry point

According to README and package.json, `highlight.js/lib/core` is a build artifact that exports the bare engine without any pre-registered languages. It is the same `HLJSApi` object but with no `registerLanguage` calls made. The source for this is `src/highlight.js` — the build pipeline controls which languages are bundled into different output entry points.

### `highlight.js/lib/common` entry point

Also a build artifact: core + a curated set of ~40 popular languages pre-registered. The `package.json` lists this as having `sideEffects: ["./es/common.js", "./lib/common.js"]` because importing it registers languages as a side effect.

---

## Plugin contract (legacy `before:*` / `after:*` hooks)

### Hook names that exist

From `types/index.d.ts:126-134` (verbatim):

```ts
export type HLJSPlugin = {
    'after:highlight'?: (result: HighlightResult) => void,
    'before:highlight'?: (context: BeforeHighlightContext) => void,
    'after:highlightElement'?: (data: { el: Element, result: HighlightResult, text: string}) => void,
    'before:highlightElement'?: (data: { el: Element, language: string}) => void,
    // TODO: Old API, remove with v12
    'after:highlightBlock'?: (data: { block: Element, result: HighlightResult, text: string}) => void,
    'before:highlightBlock'?: (data: { block: Element, language: string}) => void,
}
```

Six hook names total. The `*:highlightBlock` pair is deprecated since 10.7 and scheduled for removal in v12.

### Plugin registration (`src/highlight.js:934-958`)

```js
function upgradePluginAPI(plugin) {
    // TODO: remove with v12
    if (plugin["before:highlightBlock"] && !plugin["before:highlightElement"]) {
        plugin["before:highlightElement"] = (data) => {
            plugin["before:highlightBlock"](
                Object.assign({ block: data.el }, data)
            );
        };
    }
    if (plugin["after:highlightBlock"] && !plugin["after:highlightElement"]) {
        plugin["after:highlightElement"] = (data) => {
            plugin["after:highlightBlock"](
                Object.assign({ block: data.el }, data)
            );
        };
    }
}

function addPlugin(plugin) {
    upgradePluginAPI(plugin);
    plugins.push(plugin);
}
```

Plugins are stored in a plain array. `upgradePluginAPI` mutates the plugin object in-place to add the new hook name if only the old one is present. There is no schema validation, no error boundary per-plugin, no ordering guarantee beyond push order.

### `fire()` — the dispatch mechanism (`src/highlight.js:975-982`)

```js
function fire(event, args) {
    const cb = event;
    plugins.forEach(function(plugin) {
        if (plugin[cb]) {
            plugin[cb](args);
        }
    });
}
```

Synchronous, sequential, no error isolation. If plugin[cb] throws, it propagates to the caller. Plugins are iterated in registration order. The same single `args` object is passed to every plugin — all plugins share it and any plugin can mutate it.

### `before:highlight` fire site (`src/highlight.js:157-169`)

```js
const context = {
    code,
    language: languageName
};
// the plugin can change the desired language or the code to be highlighted
// just be changing the object it was passed
fire("before:highlight", context);

// a before plugin can usurp the result completely by providing it's own
// in which case we don't even need to call highlight
const result = context.result
    ? context.result
    : _highlight(context.language, context.code, ignoreIllegals);
```

**What `before:highlight` receives:** A `BeforeHighlightContext` object `{ code: string, language: string }`.

**What it can mutate:**
- `context.code` — change the source text before highlighting
- `context.language` — redirect to a different language
- `context.result` — short-circuit the engine entirely by setting a pre-built `HighlightResult`

**What it cannot do:** Return a value (return is ignored). Cannot be async.

**Note:** The `before:highlight` hook does NOT fire from within `highlightAuto` because `highlightAuto` calls the private `_highlight()` directly, not the public `highlight()`.

### `after:highlight` fire site (`src/highlight.js:171-173`)

```js
result.code = context.code;
// the plugin can change anything in result to suite it
fire("after:highlight", result);
```

**What `after:highlight` receives:** The full `HighlightResult` object: `{ language, value, relevance, illegal, code, _emitter, _top }`.

**What it can mutate:** Any field on the result, including `value` (the final HTML string). This is how post-processing plugins (e.g., line numbers) work.

### `before:highlightElement` fire site (`src/highlight.js:750-752`)

```js
fire("before:highlightElement",
    { el: element, language });
```

Receives `{ el: HTMLElement, language: string }`. Can mutate `language` to override the detected language. Cannot prevent highlighting (no "skip" mechanism on this hook).

### `after:highlightElement` fire site (`src/highlight.js:799`)

```js
fire("after:highlightElement", { el: element, result, text });
```

Receives `{ el: HTMLElement, result: HighlightResult, text: string }` where `text` is the pre-highlight raw text content. The element's `innerHTML` has already been set by the time this fires.

### Coupling concern

The `fire()` function and `plugins` array are private closure state inside the HLJS factory function. A plugin registered via `addPlugin()` is permanently tied to that hljs instance. `newInstance()` creates a fresh instance with an empty `plugins` array, so plugins do not cross instances. This is intentional isolation.

---

## Language definition format

### Contract: what a language file must export

Every language file exports a single default function matching `LanguageFn`:

```ts
export type LanguageFn = (hljs: HLJSApi) => Language
```

It receives the full `hljs` singleton (or instance) and returns a `Language` object. The function is called at `registerLanguage()` time (`src/highlight.js:857`):

```js
lang = languageDefinition(hljs);
```

The `hljs` argument gives the language definition access to all the `ModesAPI` helpers (`COMMENT`, `C_NUMBER_MODE`, etc.) and the `regex` utilities (`hljs.regex.concat`, etc.).

### `Language` type (verbatim from `types/index.d.ts:163-180`)

```ts
export type Language = LanguageDetail & Partial<Mode>

export interface LanguageDetail {
    name?: string
    unicodeRegex?: boolean
    rawDefinition?: () => Language
    aliases?: string[]
    disableAutodetect?: boolean
    contains: (Mode)[]
    case_insensitive?: boolean
    keywords?: string | string[] | Record<string, string | string[] | RegExp>
    isCompiled?: boolean,
    exports?: any,
    classNameAliases?: Record<string, string>
    compilerExtensions?: CompilerExt[]
    supersetOf?: string
}
```

### `Mode` shape (verbatim from `types/index.d.ts:231-263`)

```ts
interface ModeDetails {
    begin?: RegExp | string | (RegExp | string)[]
    match?: RegExp | string | (RegExp | string)[]
    end?: RegExp | string | (RegExp | string)[]
    className?: string            // deprecated: use scope
    scope?: string | Record<number, string>
    beginScope?: string | Record<number, string>
    endScope?: string | Record<number, string>
    contains?: ("self" | Mode)[]
    endsParent?: boolean
    endsWithParent?: boolean
    endSameAsBegin?: boolean
    skip?: boolean
    excludeBegin?: boolean
    excludeEnd?: boolean
    returnBegin?: boolean
    returnEnd?: boolean
    __beforeBegin?: Function
    parent?: Mode
    starts?: Mode
    lexemes?: string | RegExp
    keywords?: string | string[] | Record<string, string | string[]>
    beginKeywords?: string
    relevance?: number
    illegal?: string | RegExp | Array<string | RegExp>
    variants?: Mode[]
    cachedVariants?: Mode[]
    subLanguage?: string | string[]
    isCompiled?: boolean
    label?: string
}
```

### Example A — Simple language: JSON (`src/languages/json.js`)

Full source:

```js
import { EXTENDED_NUMBER_MODE } from "./lib/ecmascript";

export default function(hljs) {
  const ATTRIBUTE = {
    className: 'attr',
    begin: /(("(\\.|[^\\"\r\n])*")|('(\\.|[^\\'\r\n])*'))(?=\s*:)/,
    relevance: 1.01
  };
  const PUNCTUATION = {
    match: /[{}[\],:]/,
    className: "punctuation",
    relevance: 0
  };
  const LITERALS = ["true", "false", "null"];
  const LITERALS_MODE = {
    scope: "literal",
    beginKeywords: LITERALS.join(" "),
  };

  return {
    name: 'JSON',
    aliases: ['jsonc', 'json5'],
    keywords:{ literal: LITERALS },
    contains: [
      ATTRIBUTE,
      PUNCTUATION,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      LITERALS_MODE,
      EXTENDED_NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ],
    illegal: '\\S'
  };
}
```

**What this shows:**
- Mode objects are plain JS objects
- `match` is syntactic sugar for `begin` (no `end` needed)
- `className` is the deprecated spelling of `scope`
- `beginKeywords` is sugar: the compiler will rewrite it to a `begin` regex
- `hljs.APOS_STRING_MODE` etc. are pre-built Mode objects from `src/lib/modes.js` accessed via the `hljs` argument
- `EXTENDED_NUMBER_MODE` is imported from the language-level shared library `src/languages/lib/ecmascript.js` — this is a cross-language import, not a core import
- `illegal: '\\S'` makes any non-whitespace outside expected tokens abort the match early, which is critical for auto-detection precision (prevents JSON from claiming arbitrary text)

**Coupling:** JSON imports from `./lib/ecmascript` (within the `languages/lib/` shared folder) and from `hljs` argument for core modes. Two dependencies.

### Example B — Complex language: TypeScript (`src/languages/typescript.js`)

Full source is 145 lines. Key structural facts:

```js
import * as ECMAScript from "./lib/ecmascript.js";
import javascript from "./javascript.js";

export default function(hljs) {
  const tsLanguage = javascript(hljs);   // invoke the JS language factory

  // ... define TS-specific modes ...

  Object.assign(tsLanguage.keywords, KEYWORDS);        // mutate JS language's keywords
  tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR);  // mutate JS exported internals
  tsLanguage.contains = tsLanguage.contains.concat([   // extend JS contains array
    DECORATOR, NAMESPACE, INTERFACE, OPTIONAL_KEY_OR_ARGUMENT
  ]);

  swapMode(tsLanguage, "shebang", hljs.SHEBANG());    // replace mode by label
  swapMode(tsLanguage, "use_strict", USE_STRICT);

  Object.assign(tsLanguage, { name: 'TypeScript', aliases: ['ts','tsx','mts','cts'] });
  return tsLanguage;
}
```

**What this shows (coupling pattern):**
- TypeScript does not build its own Mode tree — it calls `javascript(hljs)` to get JavaScript's compiled return value and then **mutates it in-place**
- It accesses `tsLanguage.exports.PARAMS_CONTAINS` — an array exported by javascript.js via its `exports: { PARAMS_CONTAINS, CLASS_REFERENCE }` field. This is an inter-language shared-state contract
- It finds modes by `label` property (`swapMode` uses `Array.findIndex(m => m.label === label)`) — labels are a naming convention, not a typed contract
- The result is that TypeScript's Language object IS JavaScript's Language object, mutated. They share object references

**Why this resists decomposition:** If `@kindly-note/lang-typescript` and `@kindly-note/lang-javascript` are separate packages, TypeScript must somehow get JavaScript's internal mode structure to mutate. The current approach — calling `javascript(hljs)` and mutating its return value — assumes co-location or a stable cross-package internal API. The `exports` field on a Language object is an informal, untyped escape hatch.

Similarly, `src/languages/arduino.js` imports `cpp.js` directly:
```js
import cPlusPlus from './cpp.js';
export default function(hljs) {
  // calls cPlusPlus(hljs), extends the result
  ARDUINO.supersetOf = "cpp";
}
```

And `src/languages/pgsql.js` uses `supersetOf: "sql"`.

The `supersetOf` field is used in `highlightAuto()` tie-breaking (see Section 6) — it is not merely cosmetic.

---

## Mode-tree compilation pipeline

### Entry function

```js
// src/lib/mode_compiler.js:26
export function compileLanguage(language) { ... }
```

Signature: `(language: Language) => CompiledLanguage`

Called from `src/highlight.js:566`:
```js
const md = compileLanguage(language);
```

**Critically: `compileLanguage` is called every time `_highlight()` runs, not at `registerLanguage()` time.** The result is not cached on the language object after the first call. The compiled form is ephemeral per-call. (This is a performance concern for cold-start in serverless — see Section 12.)

Wait — actually checking: `compileMode` sets `mode.isCompiled = true` at line 319 of `mode_compiler.js`, and the first check in `compileMode` is `if (mode.isCompiled) return cmode;`. So compilation IS cached by mutating the original mode object. The language is compiled on first use and subsequent calls are no-ops. But this means the raw language definition object is mutated by the compiler.

### Compilation steps (inside `compileLanguage`)

The nested function `compileMode(mode, parent)` does the following in order:

1. **Guard:** `if (mode.isCompiled) return cmode` — idempotent, no double-compile
2. **Compiler extensions (built-in, run first):**
   - `EXT.scopeClassName` — promotes deprecated `className` to `scope`
   - `EXT.compileMatch` — moves `match:` to `begin:`, validates no `begin`/`end` conflict
   - `MultiClass` — handles `begin: [re1, re2, re3]` arrays with `beginScope: {1:..., 3:...}` numeric maps; rewrites into a single concatenated regex with remapped backreferences
   - `beforeMatchExt` — transforms `beforeMatch:` into a `starts:` sub-mode pattern
3. **Language-defined compiler extensions:** `language.compilerExtensions.forEach(ext => ext(mode, parent))`
4. **`__beforeBegin` reset:** set to null (will be wired by `beginKeywords` extension)
5. **More compiler extensions:**
   - `EXT.beginKeywords` — converts `beginKeywords: 'class interface'` to a `begin:` regex and wires `skipIfHasPrecedingDot` as `__beforeBegin`
   - `EXT.compileIllegal` — converts `illegal: [re1, re2]` arrays to `regex.either(...)` 
   - `EXT.compileRelevance` — defaults `relevance` to 1 if not set
6. **`isCompiled` flag set to true**
7. **Keywords compilation:** `compileKeywords(mode.keywords, language.case_insensitive)` — converts keyword strings/arrays to a `KeywordDict` (a `Record<string, [scopeName, relevanceScore]>`)
8. **Regex compilation:** `cmode.keywordPatternRe = langRe(keywordPattern, true)` — global regex for finding keyword-shaped tokens in the buffer
9. **Begin/end regex compilation:** `cmode.beginRe`, `cmode.endRe`, `cmode.terminatorEnd` — handles `endsWithParent` by appending the parent's `terminatorEnd` to the child's
10. **`illegalRe` compilation**
11. **`contains` expansion:** `expandOrCloneMode(c)` is called on each item in `contains`. This:
    - Expands `variants` into discrete modes (each variant inherits parent fields)
    - Clones modes that depend on their parent (via `endsWithParent`) to avoid shared state bugs
    - Resolves `'self'` references to the current mode
12. **Recurse into `contains`:** `mode.contains.forEach(c => compileMode(c, cmode))`
13. **Compile `starts` mode if present**
14. **Build the `ResumableMultiRegex` matcher:** `cmode.matcher = buildModeRegex(cmode)` — creates the combined alternation regex for all `contains` begin patterns plus `terminatorEnd` and `illegal`

### `buildModeRegex` detail (`src/lib/mode_compiler.js:238-251`)

```js
function buildModeRegex(mode) {
    const mm = new ResumableMultiRegex();
    mode.contains.forEach(term => mm.addRule(term.begin, { rule: term, type: "begin" }));
    if (mode.terminatorEnd) {
        mm.addRule(mode.terminatorEnd, { type: "end" });
    }
    if (mode.illegal) {
        mm.addRule(mode.illegal, { type: "illegal" });
    }
    return mm;
}
```

The `ResumableMultiRegex` joins all patterns into a single `(a)|(b)|(c)|...` regex and uses match-group position to determine which sub-pattern fired. This is the core performance mechanism — one regex exec per step instead of N separate execs.

### `expandOrCloneMode` — the modes-as-values vs modes-as-references problem

```js
function expandOrCloneMode(mode) {
    if (mode.variants && !mode.cachedVariants) {
        mode.cachedVariants = mode.variants.map(function(variant) {
            return inherit(mode, { variants: null }, variant);
        });
    }
    if (mode.cachedVariants) return mode.cachedVariants;
    if (dependencyOnParent(mode)) {
        return inherit(mode, { starts: mode.starts ? inherit(mode.starts) : null });
    }
    if (Object.isFrozen(mode)) {
        return inherit(mode);
    }
    return mode;
}
```

Shared Mode objects (e.g., `hljs.C_NUMBER_MODE`) are frozen via `deepFreeze` at `src/highlight.js:1029-1035`:
```js
for (const key in MODES) {
    if (typeof MODES[key] === "object") {
        deepFreeze(MODES[key]);
    }
}
```

When a frozen mode is encountered in `expandOrCloneMode`, it gets `inherit()`-cloned. This prevents mutation of shared modes but means compilation creates new objects per-use. The `inherit()` function (from `src/lib/utils.js`) does a shallow `Object.create(null)` copy.

---

## Emitter contract

### Minimal interface (verbatim from `src/lib/token_tree.js:106-116` comment)

```
Minimal interface:
  - addText(text)
  - __addSublanguage(emitter, subLanguageName)
  - startScope(scope)
  - endScope()
  - finalize()
  - toHTML()
```

### `Emitter` interface (verbatim from `types/index.d.ts:184-191`)

```ts
export interface Emitter {
    startScope(name: string): void
    endScope(): void
    addText(text: string): void
    toHTML(): string
    finalize(): void
    __addSublanguage(emitter: Emitter, subLanguageName: string): void
}
```

`openNode` / `closeNode` are internal to `TokenTree` (not on the public `Emitter` interface, but `TokenTreeEmitter` exposes them internally). The `HTMLRenderer` uses `openNode(node)` / `closeNode(node)` which receive a full `DataNode` object with a `scope` property. This is a separate internal interface from the public `Emitter` interface.

### The rendering pipeline: two-pass

**Pass 1 — Parsing (in `_highlight`):**

The engine calls `emitter.startScope(scope)`, `emitter.addText(text)`, `emitter.endScope()` as it walks the code. These calls build a `TokenTree` — an in-memory tree of `DataNode` objects with `scope` and `children` properties.

**Pass 2 — Rendering (in `TokenTreeEmitter.toHTML()`):**

```js
// src/lib/token_tree.js:160-163
toHTML() {
    const renderer = new HTMLRenderer(this, this.options);
    return renderer.value();
}
```

`HTMLRenderer` walks the token tree, converting `DataNode.scope` values to CSS class names via:

```js
// src/lib/html_renderer.js:32-47
const scopeToCSSClass = (name, { prefix }) => {
    if (name.startsWith("language:")) {
        return name.replace("language:", "language-");
    }
    if (name.includes(".")) {
        const pieces = name.split(".");
        return [
            `${prefix}${pieces.shift()}`,
            ...(pieces.map((x, i) => `${x}${"_".repeat(i + 1)}`))
        ].join(" ");
    }
    return `${prefix}${name}`;
};
```

A scope like `"title.class.inherited"` with prefix `"hljs-"` becomes the CSS class string `"hljs-title class_ inherited__"` (multiple space-separated classes, enabling CSS specificity targeting of nested scopes).

### Is the emitter pluggable today?

Partially. The emitter is configurable via `options.__emitter`:

```ts
// types/index.d.ts:145-154
export interface HLJSOptions {
    __emitter: EmitterConstructor
    // ...
}
interface EmitterConstructor {
    new (opts: any): Emitter
}
```

A user can call `hljs.configure({ __emitter: MyCustomEmitter })` to replace the default `TokenTreeEmitter`. The `__emitter` option is marked as beta in the options type. Third-party tools like `lowlight` use this to produce HAST (Hyperscript AST) instead of HTML strings.

**What would need to change for a clean pluggable emitter:**
1. The `__emitter` key is prefixed with `__` indicating private/unstable status; it needs a stable public name
2. The `EmitterConstructor` interface requires `new (opts: any): Emitter` — the `opts` are the full `HLJSOptions` object, creating coupling between the emitter and the core options shape
3. `__addSublanguage(emitter, subLanguageName)` leaks the emitter's internal structure (the `root` `DataNode` property) — the `TokenTreeEmitter` implementation accesses `emitter.root` which is not on the `Emitter` interface
4. The `openNode`/`closeNode` methods used by `HTMLRenderer` are not on the `Emitter` interface — they are `TokenTree` internals. A custom emitter doesn't need them (it receives `startScope`/`endScope` at the caller level), but any custom renderer walking the tree would need to know this shape

### Concrete example: how `highlight('json', '{"a":1}')` flows through the emitter

1. Parser calls `emitter.startScope("attr")` when it matches the attribute key
2. Parser calls `emitter.addText('"a"')` for the matched text
3. Parser calls `emitter.endScope()`
4. Eventually `emitter.finalize()` is called (closes any unclosed scopes)
5. `emitter.toHTML()` instantiates `HTMLRenderer(this, {classPrefix:"hljs-"})`
6. `HTMLRenderer` constructor calls `parseTree.walk(this)` which calls `_walk(builder, rootNode)`
7. For the attr node: `builder.openNode({scope:"attr", children:[...]})` → emits `<span class="hljs-attr">`
8. For the text child: `builder.addText('"a"')` → emits `&quot;a&quot;`
9. `builder.closeNode(...)` → emits `</span>`

---

## Auto-detect implementation

### Location

`src/highlight.js:685-722` — inside the HLJS factory closure.

### Full implementation (verbatim)

```js
function highlightAuto(code, languageSubset) {
    languageSubset = languageSubset || options.languages || Object.keys(languages);
    const plaintext = justTextHighlightResult(code);

    const results = languageSubset.filter(getLanguage).filter(autoDetection).map(name =>
        _highlight(name, code, false)
    );
    results.unshift(plaintext); // plaintext is always an option

    const sorted = results.sort((a, b) => {
        if (a.relevance !== b.relevance) return b.relevance - a.relevance;
        if (a.language && b.language) {
            if (getLanguage(a.language).supersetOf === b.language) {
                return 1;
            } else if (getLanguage(b.language).supersetOf === a.language) {
                return -1;
            }
        }
        return 0;
    });

    const [best, secondBest] = sorted;
    const result = best;
    result.secondBest = secondBest;
    return result;
}
```

### Cost analysis

- `languageSubset` defaults to `Object.keys(languages)` — ALL registered languages
- For each language, it calls `_highlight(name, code, false)` — a full highlight pass with the mode-tree engine
- This is O(N languages × code length) work. For the default bundle with ~40 common languages, that is 40 full highlight passes per call
- Languages with `disableAutodetect: true` are filtered by `autoDetection(name)` — this is how languages that would produce too many false positives opt out
- The `supersetOf` field is used as a tie-breaker: if Arduino and C++ tie on relevance, C++ wins because Arduino declares `supersetOf = "cpp"` (`src/languages/arduino.js:400`)

### Separation feasibility

`highlightAuto` is defined inside the HLJS factory and directly references the `languages` private map and the private `_highlight()` function. It cannot be extracted to a separate module without exposing those internals via a passed context. Conceptually it is separable — it is a pure function of `(code, languageSet, highlightFn)` — but the current implementation is closure-coupled.

If `@kindly-note/core` exposes a `highlight(code, langDef)` function, a `@kindly-note/auto-detect` package could be built that accepts a collection of language definitions and calls `highlight` for each. There is no fundamental algorithmic reason for auto-detect to be in core.

---

## Build pipeline & current package shape

### `package.json` key fields

```json
{
  "type": "commonjs",
  "main": "./lib/index.js",
  "types": "./types/index.d.ts",
  "sideEffects": [
    "./es/common.js",
    "./lib/common.js",
    "*.css",
    "*.scss"
  ]
}
```

**Notable absences:** No `"exports"` map. This means bundlers cannot perform conditional exports (CJS vs ESM), cannot restrict access to `package.json` internals, and cannot declare which paths are the official public surface. The entire package contents are accessible by path.

The `"type": "commonjs"` declaration means the published `lib/` directory is CJS. An `es/` directory in the published package is manually emitted ESM.

### Build targets (from `package.json` scripts and `docs/building-testing.rst`)

```
node tools/build.js -t node      → lib/ directory (CJS)
node tools/build.js -t cdn       → CDN bundle (IIFE, global hljs)
node tools/build.js -t browser :common  → browser bundle with common languages
```

The build tool (in `tools/build.js`, absent from shallow clone) uses Rollup to bundle `src/highlight.js` plus the selected language files into various output formats. The build script is what creates `lib/core.js`, `lib/common.js`, `lib/languages/*.js`, and their `es/` equivalents.

### Published entry points (from README usage examples)

| Path | What it is |
|---|---|
| `highlight.js` | Default import: core + ALL languages pre-registered |
| `highlight.js/lib/core` | Core engine only, zero languages |
| `highlight.js/lib/common` | Core + ~40 common languages |
| `highlight.js/lib/languages/javascript` | Individual language module (CJS) |
| `highlight.js/es/core.js` | Core engine (ESM) |
| `highlight.js/es/languages/javascript.min.js` | Individual language (ESM, minified) |
| `highlight.js/styles/*.css` | Themes |

The `es/` paths are CDN-specific and are distributed via the `@highlightjs/cdn-assets` package, not the main `highlight.js` npm package. This is a known split in the ecosystem — npm users get CJS + an `es/` parallel, CDN users get the `@highlightjs/cdn-assets` package.

### Rollup usage

Rollup is in `devDependencies` (`"rollup": "^4.0.2"`) alongside `@rollup/plugin-commonjs`, `@rollup/plugin-json`, `@rollup/plugin-node-resolve`. No `rollup.config.js` is present in the root of the upstream repo (it may be generated/embedded in the build tool). This is the build tool's internal Rollup config, not user-facing.

### What the build pipeline does NOT do

- No TypeScript compilation (source is JSDoc-annotated plain JS)
- No tree-shaking of the language set (the tool manually selects languages by name/tag)
- No code splitting per language (each entry point is a single bundled file)
- No import-map generation
- No ESM native module output for the npm package — the `es/` output is a CDN artifact

---

## Internal coupling map

This section catalogs every cross-module dependency that would resist per-language tree-shaking in a `@kindly-note` decomposition.

### Category 1: Language → core internals (direct import, hostile)

**`src/languages/fsharp.js` → `../lib/regex.js`**
```js
import * as regex from '../lib/regex.js';
```
F# imports the core regex utilities directly instead of accessing them via `hljs.regex`. This means if `@kindly-note/lang-fsharp` is a separate package, it must depend on `@kindly-note/core` (or `@kindly-note/core/regex`) as a package dependency, not just receive helpers via the `LanguageFn` argument.

**`src/languages/nsis.js` → `../lib/regex.js`**
Same pattern as F#. Dual import: `import * as regex from '../lib/regex.js'` at the top, plus `const regex = hljs.regex` inside the factory.

### Category 2: Language → language (language-to-language dependency)

**`src/languages/typescript.js` → `./javascript.js`**
TypeScript invokes the JavaScript language factory directly:
```js
import javascript from "./javascript.js";
// ...
const tsLanguage = javascript(hljs);
```
If these are separate packages, `@kindly-note/lang-typescript` must list `@kindly-note/lang-javascript` as a package dependency. Furthermore, TypeScript mutates the returned object and accesses `tsLanguage.exports.PARAMS_CONTAINS` — an informal contract on the `exports` field of the JavaScript Language object.

**`src/languages/arduino.js` → `./cpp.js`**
Same pattern: `import cPlusPlus from './cpp.js'` and `arduino.supersetOf = "cpp"`.

**`src/languages/pgsql.js` → (implicit) `sql`**
Via `supersetOf: "sql"` — not a module import, but a runtime string coupling. `highlightAuto` must have both languages registered for `supersetOf` tie-breaking to work.

### Category 3: Language → language shared libraries

**`src/languages/javascript.js` → `./lib/ecmascript.js`**
**`src/languages/typescript.js` → `./lib/ecmascript.js`**
**`src/languages/coffeescript.js` → `./lib/ecmascript.js`**
**`src/languages/livescript.js` → `./lib/ecmascript.js`**
**`src/languages/json.js` → `./lib/ecmascript.js`** (imports `EXTENDED_NUMBER_MODE`)

`src/languages/lib/ecmascript.js` exports keyword lists, built-in arrays, and `EXTENDED_NUMBER_MODE`. If `@kindly-note/lang-json` and `@kindly-note/lang-javascript` are separate packages, they would both need to depend on a shared `@kindly-note/ecmascript-helpers` package (or inline the values).

**`src/languages/css.js`, `less.js`, `scss.js`, `stylus.js` → `./lib/css-shared.js`**
Four CSS-family languages share mode helpers from `src/languages/lib/css-shared.js`. Same situation.

**`src/languages/java.js`, `kotlin.js` → `./lib/java.js`**
Both import numeric mode definitions.

**`src/languages/swift.js` → `./lib/kws_swift.js`**

**`src/languages/mathematica.js` → `./lib/mathematica.js`**

### Category 4: Language → hljs argument (expected coupling, manageable)

Every language receives the `hljs` argument and accesses `hljs.COMMENT`, `hljs.C_NUMBER_MODE`, `hljs.IDENT_RE`, `hljs.regex.concat`, etc. This is the intended coupling mechanism. For decomposition, these helpers need to be importable from a stable `@kindly-note/core/lang-helpers` (or equivalent) module, rather than requiring the full hljs singleton to be passed in.

The current design — passing the full singleton — means language factories have unlimited access to the entire API surface including `registerLanguage`, `addPlugin`, `highlightAuto`, etc. In practice they do not use these, but there is no type enforcement preventing it.

### Category 5: Language `exports` field (internal inter-language API)

`src/languages/javascript.js` returns:
```js
exports: { PARAMS_CONTAINS, CLASS_REFERENCE }
```

`src/languages/typescript.js` accesses:
```js
tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR);
```

The `exports` field (`type: any` in `LanguageDetail`) is an untyped, undocumented extension mechanism for inter-language sharing. It is used by TypeScript to reach into JavaScript's parameter-list and class-reference mode arrays. There is no registry or contract for what `exports` contains — the consuming language must know the producing language's internal structure.

`src/languages/c.js` returns:
```js
exports: {
    preprocessor: PREPROCESSOR,
    strings: STRINGS,
    keywords: KEYWORDS
}
```

This enables `cpp.js` (presumably) to build on C's internal modes — though `cpp.js` does not show an explicit import in the shallow clone's grep results, it follows the same pattern as arduino/c++.

---

## Bundle / tree-shaking pain points

### Pain point 1: No `exports` map in `package.json`

The `package.json` has `"main": "./lib/index.js"` and `"types": "./types/index.d.ts"` but no `"exports"` field. Without an exports map:
- Bundlers cannot restrict which paths are importable
- There is no ESM/CJS conditional export; the package is declared `"type": "commonjs"`, so all `require()` and `import` of the main entry resolve to CJS
- Subpath imports like `highlight.js/lib/core` work only because the files exist at those paths, not because the package declares them

### Pain point 2: `sideEffects` list undermines tree-shaking

```json
"sideEffects": [
    "./es/common.js",
    "./lib/common.js",
    "*.css",
    "*.scss"
]
```

The `sideEffects: ["./es/common.js", "./lib/common.js"]` tells bundlers that importing `common.js` has side effects (language registration). This is correct behavior but it means bundlers cannot tree-shake away unused languages from the common bundle — all languages are registered as side effects on import.

### Pain point 3: The barrel `index.js` pattern

The default `import hljs from 'highlight.js'` entry point imports `src/highlight.js` which, in the built artifact, includes ALL languages pre-registered. There is no mechanism for a bundler to determine which languages `registerLanguage` calls are actually needed. The act of calling `hljs.registerLanguage(name, fn)` is a runtime side effect — static analysis cannot determine at build time which language names the user will request.

### Pain point 4: `registerLanguage` as side effect

When a user does:
```js
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);
```
The `registerLanguage` call is a side effect on the `hljs` singleton. The language module itself (`javascript.js`) exports only a `LanguageFn` — a pure function — which IS tree-shakable in isolation. But the registration step binds it to the singleton's mutable `languages` map. If the `registerLanguage` call is tree-shaken away (because static analysis thinks it has no user-visible effect), highlighting breaks silently.

The `sideEffects` field does not help here because the language files themselves are not listed as side-effectful — only `common.js` is. This means a language-by-language import pattern is theoretically tree-shakable per-language, but only if the `registerLanguage` call is preserved.

### Pain point 5: Mode helpers as singleton properties

The `ModesAPI` helpers (`COMMENT`, `C_NUMBER_MODE`, etc.) are properties of the hljs singleton, accessed as `hljs.COMMENT(...)`. They are not importable independently from `highlight.js/lib/modes`. This means:

1. A language file cannot be loaded without the full hljs singleton present
2. The singleton's `MODES` object is deep-frozen at startup, making it impossible to replace individual helpers

For tree-shaking, language helpers would need to be importable standalone, e.g. `import { COMMENT } from '@kindly-note/core/lang-helpers'`, so that bundlers can include only the helpers actually used.

### Pain point 6: Language-to-language direct imports

`typescript.js` imports `javascript.js`. This means any bundle that includes TypeScript must also include the full JavaScript language module, even if the user only wants TypeScript. In practice TypeScript supersedes JavaScript so this is not a real loss, but the coupling pattern is not enforced at the type level — it is a file system import.

---

## Test inventory

**Note:** The shallow clone at `C:\git\highlightjs-upstream\` does NOT include the `test/` directory. It is excluded by the `.gitignore` pattern `test*.*` and not committed. The following inventory is reconstructed from documentation.

### Test framework

Mocha with the `should` assertion library. Configuration in `.mocharc.json`:
```json
{ "require": "should" }
```

### Test categories (from `package.json` scripts and `docs/building-testing.rst`)

| Command | Category | Description |
|---|---|---|
| `npm run test-markup` | Per-language markup tests | Input code → expected HTML output, stored as text fixture pairs |
| `npm run test-detect` | Auto-detection tests | Code snippet → expected detected language name |
| `npm run test-browser` | Browser integration | Runs in jsdom environment |
| `npm run test-parser` | Parser unit tests | Tests for the core parsing engine |

### Test file structure (from documentation)

**Markup tests:** `test/markup/<language>/<test_name>.txt` (input) paired with `test/markup/<language>/<test_name>.expect.txt` (expected HTML output)

**Detect tests:** `test/detect/<language>/default.txt` — a code snippet that should be recognized as that language by `highlightAuto`

**Example paths (not confirmed in clone but described in docs):**
- `test/markup/javascript/arrow_functions.txt` + `.expect.txt`
- `test/detect/json/default.txt`

### Scale estimate

The upstream repo documents 180+ built-in languages. Based on the 3rd-party contribution guide's test requirements (at minimum one detect test per language, typically several markup tests), the test suite likely contains:
- 180+ detect fixture pairs
- 500+ markup fixture pairs across all languages
- Dozens of API-level mocha tests for core functions

The exact count cannot be confirmed without the `test/` directory.

---

## Do-not-break feature list

- **`highlight(code, {language})` → `{value, relevance, illegal}` return shape** — the primary programmatic API; the `value` property being an HTML string with `<span class="hljs-*">` elements is what all downstream CSS themes target — `src/highlight.js:137-176`
- **Language registration by string name** — `registerLanguage(name, fn)` / `getLanguage(name)` / `listLanguages()`; the string-keyed registry is the canonical language lookup mechanism — `src/highlight.js:854-906`
- **Language aliases** — `registerAliases(['ts', 'tsx'], {languageName: 'typescript'})`; users specify language by alias in HTML class names and the API must resolve them — `src/highlight.js:913-918`
- **`highlightAuto(code, subset?)` returning `{language, secondBest, value}`** — used whenever language is unknown; the `secondBest` property is used by editors to offer alternate suggestions — `src/highlight.js:685-722`
- **`hljs.configure({classPrefix, cssSelector, ignoreUnescapedHTML})` options** — `classPrefix` allows users to namespace CSS classes; changing the default `hljs-` prefix would break all existing themes — `src/highlight.js:807-809`
- **`addPlugin(plugin)` / `removePlugin(plugin)` with `before:highlight`, `after:highlight`, `before:highlightElement`, `after:highlightElement` hooks** — the entire third-party plugin ecosystem depends on these hooks; the legacy adapter must faithfully present this interface — `src/highlight.js:955-982`
- **`before:highlight` context mutation** — plugins can replace `context.code`, `context.language`, or short-circuit with `context.result`; this is how code preprocessing plugins work — `src/highlight.js:157-169`
- **`after:highlight` result mutation** — plugins can rewrite `result.value`; this is how line-number injection works — `src/highlight.js:171-173`
- **`highlightElement(el)` DOM API** — takes an HTMLElement, reads `textContent`, writes `innerHTML`; also sets `el.dataset.highlighted`, `el.result`, `el.secondBest`; widely used in browser integrations — `src/highlight.js:743-800`
- **`highlightAll()` auto-init** — scans `document.querySelectorAll('pre code')`, respects `options.cssSelector`; the zero-config browser entry point — `src/highlight.js:828-846`
- **`disableAutodetect: true` on language definitions** — languages can opt out of auto-detection; must be honored by `highlightAuto` — `src/highlight.js:689`
- **`newInstance()` — isolated highlighter instances** — used by lowlight, unified/rehype ecosystem to run multiple isolated highlighters; each instance has its own language registry and plugin list — `src/highlight.js:1048`
- **`subLanguage` — embedded language highlighting** — e.g., JavaScript embedded in HTML, CSS in JavaScript tagged templates; this requires the core engine to recursively call itself or `highlightAuto` — `src/highlight.js:240-264`
- **`supersetOf` field** — used to break ties in auto-detection; C++ should win over Arduino when the code is ambiguous — `src/highlight.js:700-705`
- **`scope`-to-CSS class mapping with tiered scopes** — `"title.class.inherited"` → `"hljs-title class_ inherited__"`; existing themes use these multi-class patterns for CSS specificity; changing this mapping breaks all themes — `src/lib/html_renderer.js:32-47`
- **`hljs.regex` utilities exposed on the API** — `concat`, `lookahead`, `either`, `optional`, `anyNumberOfTimes`; third-party language definitions use these — `src/highlight.js:1021-1027`
- **`compilerExtensions` on Language** — allows grammars to register custom compilation passes; currently marked as 1st-party only but the API exists — `src/lib/mode_compiler.js:305`
- **`__emitTokens` escape hatch on Language** — allows a language to bypass the mode engine entirely and emit tokens via the Emitter API directly; planned for v12 as stable; needed for languages where the regex engine is a poor fit — `src/highlight.js:581-607`, `docs/mode-reference.rst:108`
- **`SAFE_MODE` default-on error swallowing** — in safe mode, parse errors return escaped plaintext instead of throwing; this is the default and users depend on it not crashing their pages — `src/highlight.js:59-61`, `src/highlight.js:636-648`
- **`versionString` property** — used by plugins/tooling to check compatibility — `src/highlight.js:1019`

---

## Open questions for the Topic Director / Architect

1. **`vuePlugin`** is declared in `types/index.d.ts` but absent from `src/highlight.js`. It must be injected by the build pipeline for specific targets. Is this capability needed in `kindly-note`? If yes, where does it live — in `@kindly-note/core` or a separate `@kindly-note/vue`?

2. **Compilation caching strategy.** The current design compiles a Language's Mode tree on first `_highlight()` call by mutating `mode.isCompiled = true` on the raw definition object. This means compiled state persists in-memory for the lifetime of the registered language. For `kindly-note`, is the Language definition pure/immutable (compiled to a compiled form on `registerLanguage`)? Or is eager compilation at registration time preferred? The answer affects whether language packages can export pre-compiled definitions.

3. **`exports` field for inter-language sharing.** TypeScript accesses `tsLanguage.exports.PARAMS_CONTAINS` from JavaScript. If `@kindly-note/lang-typescript` and `@kindly-note/lang-javascript` are separate packages, what typed mechanism replaces this? Options include: (a) a typed extension API on `LanguageDefinition`, (b) TypeScript importing named exports from JavaScript's package, (c) a shared `@kindly-note/ecmascript-helpers` package that both import. This is a design decision, not a fact from the source.

4. **`before:highlight` and `highlightAuto` interaction.** Currently `before:highlight` does NOT fire when called from `highlightAuto` (because `highlightAuto` calls private `_highlight()` directly). This is documented behavior. Should `kindly-note` preserve this asymmetry? A plugin that watches `before:highlight` will NOT be called during auto-detect passes.

5. **`__emitter` pluggability.** The emitter is already swappable but the interface has rough edges (`__addSublanguage` leaking internal DataNode structure, `opts: any` constructor, `openNode`/`closeNode` not on the public interface). Should `kindly-note` standardize a typed `EmitterFactory` interface as a first-class concept?

6. **`supersetOf` cross-package reference.** When `arduino.supersetOf = "cpp"`, this is a runtime string pointing to another registered language. In a per-package world, does `@kindly-note/lang-arduino` declare `supersetOf: "@kindly-note/lang-cpp"` by package name, or does the string remain a language name that must be present in the registry at auto-detect time?

7. **The `language.exports` field typing.** The type is `exports?: any` which is untyped. For the modern plugin protocol design, should language packages be able to expose extension points? If yes, what is the typed shape? This affects whether TypeScript-style language inheritance (calling another language's factory) can be expressed in a type-safe way.

8. **Scope name compatibility.** Existing CSS themes use `.hljs-keyword`, `.hljs-title.class_` etc. Should `kindly-note` use the same CSS class names? If `classPrefix` defaults to `"hljs-"` and the tiered scope encoding (`title.class.inherited` → `hljs-title class_ inherited__`) is preserved verbatim, existing themes work drop-in. If changed, all themes break.

9. **Test directory contents.** The `test/` directory is absent from the shallow clone due to `.gitignore`. Exact test counts, test helper structure, and whether there are integration tests beyond markup/detect fixtures cannot be confirmed. Before writing `kindly-note`'s test harness, the full test suite should be examined from a complete clone.

10. **`highlightAll()` / `highlightElement()` DOM dependency.** These functions reference `document`, `window`, `HTMLElement`, and `element.innerHTML`. For Workers/Edge runtimes, there is no DOM. Should `kindly-note/core` omit these functions entirely (making them part of a `@kindly-note/browser` package)? Or should they be present but behind a runtime capability check?

11. **`SAFE_MODE` default behavior.** In safe mode, language parse errors are swallowed and escaped plaintext is returned. In debug mode (`hljs.debugMode()`), errors throw. Should `kindly-note` expose this as a named option (`{ errorMode: 'safe' | 'throw' }`) rather than two global methods? The current API surface (`debugMode()` / `safeMode()`) is stateful and non-obvious.

12. **The `fsharp.js` / `nsis.js` direct import of `../lib/regex.js`.** These two languages import core internals directly by file path. Is this a pattern to discourage (by making `@kindly-note/core/regex` a stable importable sub-path) or to prohibit (by requiring language factories to use only the `hljs.regex` argument)? The answer defines whether language packages have an explicit or implicit dependency on the core package.

---

**Essential files for Architect reference:**

- `C:\git\highlightjs-upstream\types\index.d.ts` — authoritative type definitions for the entire public API
- `C:\git\highlightjs-upstream\src\highlight.js` — the engine: all public methods, plugin system, highlight loop
- `C:\git\highlightjs-upstream\src\lib\mode_compiler.js` — compilation pipeline entry point and `ResumableMultiRegex`
- `C:\git\highlightjs-upstream\src\lib\token_tree.js` — `TokenTreeEmitter` (the default emitter)
- `C:\git\highlightjs-upstream\src\lib\html_renderer.js` — HTML rendering from token tree, scope-to-CSS mapping
- `C:\git\highlightjs-upstream\src\lib\modes.js` — all built-in mode helpers and regex constants
- `C:\git\highlightjs-upstream\src\lib\compiler_extensions.js` — built-in compiler extensions (`compileMatch`, `beginKeywords`, etc.)
- `C:\git\highlightjs-upstream\src\lib\compile_keywords.js` — keyword compilation to `KeywordDict`
- `C:\git\highlightjs-upstream\src\lib\response.js` — the `CallbackResponse` object passed to `on:begin`/`on:end` callbacks
- `C:\git\highlightjs-upstream\src\languages\json.js` — simplest production language example
- `C:\git\highlightjs-upstream\src\languages\typescript.js` — complex inter-language inheritance example
- `C:\git\highlightjs-upstream\src\languages\javascript.js` — the language TypeScript inherits from; shows `exports` field pattern
- `C:\git\highlightjs-upstream\src\languages\lib\ecmascript.js` — shared language helpers (cross-language coupling example)
- `C:\git\highlightjs-upstream\docs\plugin-api.rst` — authoritative plugin hook documentation
- `C:\git\highlightjs-upstream\docs\mode-reference.rst` — authoritative mode attribute documentation
- `C:\git\highlightjs-upstream\docs\css-classes-reference.rst` — all valid scope names and their semantic meaning
- `C:\git\highlightjs-upstream\package.json` — package shape, sideEffects declaration, build scripts

---

I was unable to write this content to `C:\git\kindly-note\docs\plan\scout-report.md` because no file-write tool is available in this tool configuration. The full report content is delivered above as the assistant response. The Architect should copy this document to the target path.
