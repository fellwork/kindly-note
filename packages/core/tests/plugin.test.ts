// Tests for definePlugin, the phase pipeline, and error isolation.
// Acceptance test #2 from dispatch sec D.
import { describe, expect, it, vi } from 'vitest';
import {
  type CodeInput,
  type HighlightResult,
  type PluginContext,
  createHighlighter,
  defineLanguage,
  definePlugin,
} from '../src/index.js';

const noopLang = defineLanguage({ name: 'noop', contains: [] });

function silentLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('plugin pipeline (spec §2.3)', () => {
  it('threads transformCode return values plugin-to-plugin in registration order', () => {
    const seen: string[] = [];
    const A = definePlugin({
      name: 'A',
      apiVersion: '1',
      transformCode(input) {
        seen.push(`A-saw:${input.code}`);
        return { ...input, code: `${input.code} /* a */` };
      },
    });
    const B = definePlugin({
      name: 'B',
      apiVersion: '1',
      transformCode(input) {
        seen.push(`B-saw:${input.code}`);
        return { ...input, code: `${input.code} /* b */` };
      },
    });

    let receivedByEngine: CodeInput | undefined;
    const Spy = definePlugin({
      name: 'spy',
      apiVersion: '1',
      transformCode(input) {
        receivedByEngine = input;
        return input;
      },
    });

    const hl = createHighlighter({
      languages: [noopLang],
      plugins: [A, B, Spy],
    });
    hl.highlight('x', { language: 'noop' });

    expect(seen).toEqual(['A-saw:x', 'B-saw:x /* a */']);
    expect(receivedByEngine?.code).toBe('x /* a */ /* b */');
  });

  it('plugins do NOT receive a shared mutable context between callsites', () => {
    // Each plugin gets its own PluginContext (closed-over WeakMap in
    // HighlighterImpl). Mutating ctx.state in one plugin must not leak.
    let aState: PluginContext | undefined;
    let bState: PluginContext | undefined;
    const A = definePlugin({
      name: 'A',
      apiVersion: '1',
      transformCode(input, ctx) {
        aState = ctx;
        ctx.state.set('shared-key', 'A-only');
        return input;
      },
    });
    const B = definePlugin({
      name: 'B',
      apiVersion: '1',
      transformCode(input, ctx) {
        bState = ctx;
        return input;
      },
    });

    const hl = createHighlighter({
      languages: [noopLang],
      plugins: [A, B],
      logger: () => silentLogger(),
    });
    hl.highlight('x', { language: 'noop' });

    expect(aState).toBeDefined();
    expect(bState).toBeDefined();
    expect(aState).not.toBe(bState);
    // B's state is empty; A's mutation didn't leak.
    expect(bState?.state.has('shared-key')).toBe(false);
    expect(aState?.state.get('shared-key')).toBe('A-only');
  });

  it('shortCircuit stops the pipeline before _highlight runs', () => {
    let engineRanText = '';
    const watchEngine = definePlugin({
      name: 'watch',
      apiVersion: '1',
      // Phase 3 fires AFTER _highlight, so if the engine ran, the result.value
      // would contain the language output. With shortCircuit setting result,
      // value should be the canned value.
      transformResult(result) {
        engineRanText = result.value;
        return result;
      },
    });
    const sc = definePlugin({
      name: 'sc',
      apiVersion: '1',
      shortCircuit() {
        const r: HighlightResult = {
          value: 'CANNED',
          relevance: 0,
          illegal: false,
          language: 'noop',
        };
        return r;
      },
    });

    const hl = createHighlighter({
      languages: [noopLang],
      plugins: [sc, watchEngine],
    });
    const out = hl.highlight('alpha-bravo-charlie', { language: 'noop' });
    expect(out.value).toBe('CANNED');
    expect(engineRanText).toBe('CANNED');
  });

  it('transformResult is threaded plugin-to-plugin', () => {
    const A = definePlugin({
      name: 'A',
      apiVersion: '1',
      transformResult(r) {
        return { ...r, value: `${r.value}|A` };
      },
    });
    const B = definePlugin({
      name: 'B',
      apiVersion: '1',
      transformResult(r) {
        return { ...r, value: `${r.value}|B` };
      },
    });
    const hl = createHighlighter({ languages: [noopLang], plugins: [A, B] });
    const out = hl.highlight('hello', { language: 'noop' });
    expect(out.value).toMatch(/\|A\|B$/);
  });
});

describe('error isolation (spec §2.4)', () => {
  // Acceptance test #2 cont. error-mode handling.
  const boom = definePlugin({
    name: 'boom',
    apiVersion: '1',
    transformResult() {
      throw new Error('boom');
    },
  });

  it("errorMode: 'safe' (default) does not crash — passthrough applies", () => {
    const hl = createHighlighter({
      languages: [noopLang],
      plugins: [boom],
      logger: () => silentLogger(),
    });
    expect(() => hl.highlight('x', { language: 'noop' })).not.toThrow();
  });

  it("errorMode: 'throw' propagates the error wrapped in a PluginError", () => {
    const hl = createHighlighter({
      languages: [noopLang],
      plugins: [boom],
      errorMode: 'throw',
      logger: () => silentLogger(),
    });
    expect(() => hl.highlight('x', { language: 'noop' })).toThrow(
      /plugin "boom" threw in transformResult/,
    );
  });
});
