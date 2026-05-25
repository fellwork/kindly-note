---
'@kindly-note/core': minor
---

Add the optional `startScopeWithAttrs(scope, attrs)` method to the `Emitter` contract (spec §13.3a, decision (a)).

This is the backward-compatible enabler for attribute-bearing semantic HTML (`<a href>`, `<h1 id>`, `<img src alt>`) in the new `@kindly-note/emitters-markdown` package. The method is **optional**: existing emitters (`@kindly-note/emitters-html`, the internal recording emitter) do not implement it and are unaffected.

**Engine plumbing:** a `Mode` (and the compiled `CompiledMode`) may now carry a static `attrs: Readonly<Record<string, string>>` payload. When a mode with `attrs` opens its scope, the matcher calls `startScopeWithAttrs` if the emitter implements it, otherwise it falls back to `startScope(scope)`. Modes without `attrs` always take the plain `startScope` path, so every shipped highlighting language behaves exactly as before.

No breaking changes: all 71 pre-existing `core` tests pass unchanged; 3 new tests cover the attrs routing + the backward-compatible fallback.
