// URL allowlist / scheme policy for @kindly-note/emitters-markdown.
//
// spec §13.1 (URL rows): the default policy permits only a small allowlist of
// schemes plus anchor (`#…`) and relative URLs; everything else (notably
// `javascript:`, `vbscript:`, `data:`, `file:`) is neutralised — the link text
// is preserved but the `href` is dropped. Auto-linked URLs in text are checked
// against the same allowlist.
//
// This is a STRUCTURAL guarantee, not a sanitiser pass: the renderer asks the
// policy "what href, if any, should this URL produce" and only ever emits the
// returned value. A `null` return means "no href" — the renderer emits the
// link/image text but never an attribute carrying a dangerous scheme.

/**
 * A URL policy: given a raw URL string from markdown source, return the href
 * to emit, or `null` to emit no href. Pure and synchronous (spec §13.5: v0/v1.0
 * markdown rendering is sync-only — no async link probing).
 */
export type UrlPolicy = (url: string) => string | null;

/** The default scheme allowlist. spec §13.1. */
export const DEFAULT_URL_ALLOWLIST: readonly string[] = Object.freeze([
  'http',
  'https',
  'mailto',
  'tel',
]);

// Leading / embedded control characters and whitespace are stripped before
// scheme analysis so `java\tscript:` / `java\nscript:` obfuscation cannot
// smuggle a blocked scheme past the check (browsers ignore these inside the
// scheme). Written with \u escapes so the source carries no literal control
// bytes; the class covers C0 controls (U+0000–U+001F) and the space.
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping C0 control chars is the security intent.
const CONTROL_AND_WS_RE = /[\u0000-\u0020]/g;

/**
 * Extract the scheme of a URL (the part before the first `:`), lowercased, or
 * `undefined` when the URL has no scheme (relative path / fragment / etc.).
 *
 * A `:` that appears after a path/query/fragment delimiter, or that is not
 * preceded by a valid scheme token (`[a-z][a-z0-9+.-]*`), is NOT a scheme
 * separator — e.g. `/path:with:colons` or `foo?a=b:c` are schemeless.
 */
function schemeOf(url: string): string | undefined {
  const colon = url.indexOf(':');
  if (colon < 0) return undefined;
  const candidate = url.slice(0, colon);
  // A scheme cannot contain a path/query/fragment delimiter.
  if (/[/?#\\]/.test(candidate)) return undefined;
  // RFC 3986 scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ).
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(candidate)) return undefined;
  return candidate.toLowerCase();
}

/**
 * Build a {@link UrlPolicy} from a scheme allowlist. The returned policy:
 *   - permits fragment-only URLs (`#section`),
 *   - permits scheme-relative (`//host/...`) and path-relative / absolute-path
 *     URLs (no scheme),
 *   - permits any URL whose scheme is in `allowlist` (case-insensitive),
 *   - returns `null` for everything else (e.g. `javascript:`, `data:`,
 *     `vbscript:`, `file:`).
 *
 * Obfuscation via leading / embedded control characters in the scheme is
 * defeated by stripping those characters before scheme analysis.
 */
export function allowlistUrlPolicy(allowlist: readonly string[]): UrlPolicy {
  const allowed = new Set(allowlist.map((s) => s.toLowerCase()));
  return (rawUrl: string): string | null => {
    const url = rawUrl.trim();
    if (url === '') return null;
    // Defeat control-character obfuscation in the scheme region: analyse a
    // de-controlled copy, but emit the trimmed original when permitted.
    const deControlled = url.replace(CONTROL_AND_WS_RE, '');
    const scheme = schemeOf(deControlled);
    if (scheme === undefined) {
      // No scheme: fragment, relative, or absolute path. All permitted.
      return url;
    }
    if (allowed.has(scheme)) {
      return url;
    }
    return null;
  };
}

/**
 * The default URL policy — the {@link DEFAULT_URL_ALLOWLIST} plus relative /
 * fragment URLs. spec §13.1.
 */
export const defaultUrlPolicy: UrlPolicy = allowlistUrlPolicy(DEFAULT_URL_ALLOWLIST);
