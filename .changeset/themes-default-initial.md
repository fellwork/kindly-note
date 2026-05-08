---
'@kindly-note/themes-default': minor
---

Initial release of `@kindly-note/themes-default`: first-party CSS theme set
for kindly-note. Ships `dark.css`, `light.css`, `high-contrast.css` (target
the default `kn-*` class prefix per spec §7.4), and `compat-hljs.css` (a
variable-mapping shim that lets users keep their existing `hljs-*` themes
with kindly-note's `kn-*` rendering output). Plus `tokens.json` for design-
system integration. CSS-only package — no runtime behaviour beyond a typed
re-export of the token bundle.
