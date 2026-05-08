# Scout Report — Gap-fill (§7 Build pipeline, §10 Test inventory)

> Replaces the thin §7 and §10 in `scout-report.md`. Architect should treat THIS file as authoritative for those two sections.

## §7 Build pipeline & current package shape

### tools/ inventory

`C:\git\highlightjs-upstream\tools\` contents (from Glob):

```
tools/build.js                   — CLI entrypoint, dispatches to build_<target>
tools/build_browser.js           — browser/IIFE target builder
tools/build_cdn.js               — CDN target builder
tools/build_config.js            — shared rollup + terser config object
tools/build_node.js              — node (CJS + ESM) target builder
tools/buildSizeReport.js         — post-build size reporting helper
tools/checkAutoDetect.js         — auto-detection accuracy checker
tools/checkTheme.js              — theme contrast checker
tools/perf.js                    — performance benchmarking
tools/lib/bundling.js            — thin rollup wrappers (rollupCode, rollupWrite, sha384)
tools/lib/dependencies.js        — language dependency resolver/filter
tools/lib/external_language.js   — third-party/extra language loader
tools/lib/language.js            — Language class + getLanguages()
tools/lib/makestuff.js           — fs helpers (install, mkdir, installCleanCSS, renderTemplate)
tools/css/                       — directory: CSS post-processing helpers
tools/developer.html             — local developer demo HTML
tools/sample_files/python.txt
tools/templates/DIGESTS.md       — SRI digest Markdown template
tools/vendor/jquery-2.1.1.min.js
```

There is **no external `rollup.config.js`** — all rollup configuration is defined inline in `tools/build_config.js` and consumed programmatically. Build toolchain is hand-rolled rollup + terser; **no esbuild, no tsup**.

### package.json scripts and sideEffects

`package.json:41-56`:

```
"build":               "node ./tools/build.js -t node"
"build-cdn":           "node ./tools/build.js -t cdn"
"build-browser":       "node ./tools/build.js -t browser :common"
"test":                "mocha test"
"test-markup":         "mocha test/markup"
"test-detect":         "mocha test/detect"
"test-browser":        "mocha test/browser"
"test-parser":         "mocha test/parser"
```

`sideEffects` (`package.json:35-40`):

```
sideEffects = [
  "./es/common.js",
  "./lib/common.js",
  "*.css",
  "*.scss"
]
```

`package.json:33-34` declares `"type": "commonjs"` and `"main": "./lib/index.js"`. **There is no static `exports` field in source `package.json` — it is generated at build time** by `tools/build_node.js`.

Build-relevant devDependencies: `rollup` ^4.0.2, `@rollup/plugin-commonjs` ^28.0.1, `@rollup/plugin-json` ^6.0.1, `@rollup/plugin-node-resolve` ^15.3.0, `terser` ^5.21.0, `clean-css` ^5.3.2, `glob-promise` ^6.0.5, `handlebars` ^4.7.8.

### Node-target build flow (tools/build_node.js:150-207)

`buildNode` orchestration:

1. Creates skeleton: `lib/languages/`, `es/languages/`, `styles/`, `scss/`, `types/`.
2. Copies static files (LICENSE, README, CHANGES, types/index.d.ts).
3. Processes `src/styles/*.css` through `clean-css` → unminified + `.min.css` + `.scss` stubs.
4. Calls `getLanguages()` (`tools/lib/language.js:106`) — globs `./src/languages/*.js`, wraps each in `Language` class. Third-party packages from `tools/lib/external_language.js` appended.
5. Calls `filter(languages, options.languages)` (`tools/lib/dependencies.js:50`) — resolves includes, topologically sorts via the `dependency-resolver` package.
6. Writes `build/package.json` with generated `exports` map.
7. Writes CJS index files (`lib/index.js`, `lib/common.js`) via `buildCJSIndex` (lines 21-35) — **hand-generated strings, not rollup**.
8. Writes ESM stubs (`es/index.js`, `es/common.js`) via `buildESMStub` (lines 12-18) — re-exports from `lib/` counterpart.
9. `buildLanguages` fans out `buildNodeLanguage` per language, in parallel.
10. `buildNodeHighlightJS` runs rollup on `src/highlight.js` to produce `lib/core.js`.

`buildNodeLanguage` (lines 37-66) per language:
- Rollup-bundles source language to `lib/languages/<name>.js` (CJS, format `cjs`).
- Writes deprecation-warning stub at `lib/languages/<name>.js.js` for consumers who include the trailing `.js` in their import specifier.
- If ESM enabled, writes `es/languages/<name>.js` (format `es`) and matching `.js.js` stub.

### Generated exports map (tools/build_node.js:104-116)

```
generatePackageExports = () => ({
  ".": {
    "types": "./types/index.d.ts",
    ...dual("./lib/index.js"),
  },
  "./package.json": "./package.json",
  "./lib/common":     dual("./lib/common.js"),
  "./lib/core":       dual("./lib/core.js"),
  "./lib/languages/*": dual("./lib/languages/*.js"),
  "./scss/*":   "./scss/*",
  "./styles/*": "./styles/*",
  "./types/*":  "./types/*"
})
```

`dual(file)` (`tools/build_node.js:97-102`) produces `{ require: file, import: file.replace("/lib/", "/es/") }` — every CJS path automatically gets an ESM counterpart.

### Per-language entry-point mapping

A user import `highlight.js/lib/languages/typescript` resolves via the wildcard `"./lib/languages/*": dual("./lib/languages/*.js")`. `require` condition maps to `build/lib/languages/typescript.js`; `import` condition maps to `build/es/languages/typescript.js`. Both produced by rollup-bundling `src/languages/typescript.js`. Output filename derives from `language.name` (basename minus `.js`), per `tools/build_node.js:52-53`.

### Rollup config (tools/build_config.js:15-41)

```
rollup = {
  core: {
    input: { plugins: [ cjsPlugin(), jsonPlugin(), nodeResolve(), <module shim remover> ] }
  },
  node:        { output: { format: "cjs", strict: false, exports: "auto", footer: "" } },
  browser_iife: {
    output: {
      name: "hljs",
      format: "iife",
      footer: <CJS interop one-liner>
    }
  }
}
```

Minification is `terser` directly (not as a rollup plugin). Terser config (`tools/build_config.js:58-73`) targets ES2015, two compression passes, ASCII-only output.

### CDN and browser targets (summary)

- **CDN** (`tools/build_cdn.js`) wraps each language as IIFE registering itself with `hljs.registerLanguage(name, def)`, plus a separate ESM string. Both terser-minified to `build/languages/<name>.min.js` and `build/es/languages/<name>.min.js`.
- **Browser** (`tools/build_browser.js`) uses a virtual rollup plugin `builtInLanguagesPlugin` (lines 183-200) that synthesizes a `builtInLanguages` virtual module. Rollup bundles `src/stub.js` + core + all-langs into a single IIFE `highlight.js` file.

### Implications for kindly-note (Architect-relevant)

- **No source `exports` map** — generation is build-time. kindly-note can adopt static per-package `exports` from day one.
- **Hand-generated CJS index files** are just barrel re-exports. kindly-note's monorepo replaces this with real packages.
- **Topological dependency resolver** in `tools/lib/dependencies.js` exists because language source declares cross-language deps in metadata. kindly-note's per-package `dependencies` field replaces this entirely.
- **Browser target's virtual `builtInLanguages` module** is the exact pattern kindly-note must avoid. The `@kindly-note/all` bundle should be a real package whose `index.ts` re-exports from sibling packages, statically.

---

## §10 Test inventory

### Directory structure (test/ subdirs)

```
test/api/        — core API unit tests (JS, Mocha)
test/browser/    — jsdom/browser environment tests
test/builds/     — built-artifact smoke tests (CJS + ESM consumption)
test/detect/     — auto-detection fixture files (TXT)
test/markup/     — render-output fixture pairs (TXT)
test/parser/     — parser internals unit tests
```

### Categories and counts (from Glob)

| Category | Path | Count | Format |
|---|---|---|---|
| Markup fixtures | `test/markup/**/*.txt` | **1072** total — **534 .expect.txt** + 538 input .txt. **534 test cases** across ~100 language subdirs. | Pair: input + expected |
| Auto-detect fixtures | `test/detect/**/*.txt` | **198** | Single raw-source file per case |
| API unit tests | `test/api/*.js` | **15** (14 modules + index) | Mocha + should |
| Parser unit tests | `test/parser/*.js` | **8** (7 modules + index) | Mocha + should |
| Browser integration | `test/browser/*.js` | **5** | jsdom + tiny-worker |
| Build smoke tests | `test/builds/*.{js,mjs}` | **7** | CJS / ESM / rollup consumption |

API test modules: `autoDetection`, `beginKeywords`, `binaryNumber`, `cNumber`, `getLanguage`, `highlight`, `ident`, `keywords`, `multiClassMatch`, `number`, `registerAlias`, `starters`, `underscoreIdent`, `unregisterLanguage`.

Parser test modules: `beginEndScope`, `compiler-extensions`, `look-ahead-end-matchers`, `max_keyword_hits`, `resume-scan`, `reuse-endsWithParent`, `should-not-destroyData`.

Build smoke tests: `browser_build_as_commonjs.js`, `cdn_build_as_esm.mjs`, `node_build_as_esm.mjs`, `package.js`, `rollup_import_cdn_build_esm.mjs`, `rollup_import_node_build_esm.mjs`, `rollup_import_via_commonjs.mjs`.

### Sample fixture pair — TypeScript class test

Input file `test/markup/typescript/class.txt` (verbatim, abridged for length): a TS class declaring an interface, a constructor, template literals, and `extends Vehicle`. Full content in repo.

Expected file `test/markup/typescript/class.expect.txt`: the byte-identical HTML the runner asserts against, e.g. `<span class="hljs-keyword">class</span>` `<span class="hljs-title class_">Car</span>` `<span class="hljs-keyword">extends</span>` `<span class="hljs-title class_ inherited__">Vehicle</span>` and so on through every token.

**The contract:** runner passes the input to `hljs.highlight(src, { language })` and asserts that `.value` is byte-for-byte equal to `.expect.txt`. **No tolerance, no whitespace normalization.**

### Test runner

Framework: **Mocha** ^11.0.1. Assertion lib: **should** ^13.2.3. `package.json:51` is `"test": "mocha test"` — Mocha's recursive mode discovers `*.js` test files. Subdirectories with `index.js` (`test/api/`, `test/browser/`, `test/parser/`) use that as the `describe` container that requires sibling modules. Markup and detect fixture suites read `.txt` pairs from disk at test time.

### Implications for kindly-note (Architect-relevant)

- **534 markup fixture pairs are the "do not regress" surface.** kindly-note must offer a path to run them — likely a thin per-language adapter that converts a kindly-note highlight result to the expected HTML string.
- **Byte-for-byte HTML equality is the contract.** This locks kindly-note's default emitter to produce CSS classes in the same order/structure as upstream's `HTMLRenderer` if we want fixtures to pass unchanged. **Architect must decide:** keep fixture-byte-compat as a constraint on `@kindly-note/emitters-html`, or rewrite/regenerate fixtures (1072 files).
- **No TypeScript test files exist.** Upstream tests are all `.js`/`.mjs`. kindly-note can adopt Vitest + native TS tests without losing coverage.
