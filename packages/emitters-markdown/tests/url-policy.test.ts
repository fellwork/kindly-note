// Unit tests for the URL security policy. spec §13.1.

import { describe, expect, it } from 'vitest';
import { DEFAULT_URL_ALLOWLIST, allowlistUrlPolicy, defaultUrlPolicy } from '../src/index.js';

describe('defaultUrlPolicy (spec §13.1)', () => {
  it('permits the allowlisted schemes', () => {
    expect(defaultUrlPolicy('http://x.com')).toBe('http://x.com');
    expect(defaultUrlPolicy('https://x.com/a?b=c#d')).toBe('https://x.com/a?b=c#d');
    expect(defaultUrlPolicy('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(defaultUrlPolicy('tel:+15551234')).toBe('tel:+15551234');
  });

  it('permits fragment, relative, and absolute-path URLs (no scheme)', () => {
    expect(defaultUrlPolicy('#section')).toBe('#section');
    expect(defaultUrlPolicy('/abs/path')).toBe('/abs/path');
    expect(defaultUrlPolicy('rel/path')).toBe('rel/path');
    expect(defaultUrlPolicy('//cdn.example.com/x')).toBe('//cdn.example.com/x');
    expect(defaultUrlPolicy('./a/b.png')).toBe('./a/b.png');
  });

  it('blocks dangerous schemes (returns null)', () => {
    expect(defaultUrlPolicy('javascript:alert(1)')).toBeNull();
    expect(defaultUrlPolicy('JavaScript:alert(1)')).toBeNull();
    expect(defaultUrlPolicy('vbscript:msgbox(1)')).toBeNull();
    expect(defaultUrlPolicy('data:text/html,<script>1</script>')).toBeNull();
    expect(defaultUrlPolicy('file:///etc/passwd')).toBeNull();
  });

  it('defeats control-character / whitespace scheme obfuscation', () => {
    expect(defaultUrlPolicy('java\tscript:alert(1)')).toBeNull();
    expect(defaultUrlPolicy('java\nscript:alert(1)')).toBeNull();
    expect(defaultUrlPolicy(' javascript:alert(1)')).toBeNull();
    expect(defaultUrlPolicy('javascript:alert(1)')).toBeNull();
  });

  it('treats colons after path/query as schemeless (relative)', () => {
    expect(defaultUrlPolicy('/path:with:colons')).toBe('/path:with:colons');
    expect(defaultUrlPolicy('foo?a=b:c')).toBe('foo?a=b:c');
  });

  it('returns null for empty / whitespace-only URLs', () => {
    expect(defaultUrlPolicy('')).toBeNull();
    expect(defaultUrlPolicy('   ')).toBeNull();
  });
});

describe('allowlistUrlPolicy', () => {
  it('honours a custom scheme set', () => {
    const policy = allowlistUrlPolicy(['https']);
    expect(policy('https://x.com')).toBe('https://x.com');
    expect(policy('http://x.com')).toBeNull();
    expect(policy('mailto:a@b.com')).toBeNull();
  });

  it('is case-insensitive on scheme', () => {
    const policy = allowlistUrlPolicy(['HTTPS']);
    expect(policy('https://x.com')).toBe('https://x.com');
  });
});

describe('DEFAULT_URL_ALLOWLIST', () => {
  it('contains exactly the documented schemes and is frozen', () => {
    expect([...DEFAULT_URL_ALLOWLIST].sort()).toEqual(['http', 'https', 'mailto', 'tel']);
    expect(Object.isFrozen(DEFAULT_URL_ALLOWLIST)).toBe(true);
  });
});
