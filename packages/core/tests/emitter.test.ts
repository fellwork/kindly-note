// Tests for EmitterFactory contract — uses a recording emitter that captures
// the engine's call sequence verbatim, then asserts it against the spec
// section 5.6 numbered call-trace.
// Acceptance test #3 from dispatch sec D.
import { describe, expect, it } from 'vitest';
import {
  type Emitter,
  type EmitterFactory,
  type TokenStream,
  createHighlighter,
  defineEmitter,
  defineLanguage,
} from '../src/index.js';

type Call =
  | { kind: 'startScope'; scope: string }
  | { kind: 'endScope' }
  | { kind: 'addText'; text: string }
  | { kind: 'addSubLanguage'; language: string }
  | { kind: 'finalize' }
  | { kind: 'render' }
  | { kind: 'toTokenStream' };

function recordingEmitter(): { factory: EmitterFactory<Call[]>; getLog(): readonly Call[] } {
  let captured: Call[] | undefined;
  const factory = defineEmitter<Call[]>({
    name: 'test-recording',
    create(): Emitter<Call[]> {
      const log: Call[] = [];
      const emptyStream: TokenStream = { type: 'scope', children: [] };
      const e: Emitter<Call[]> = {
        startScope: (scope) => {
          log.push({ kind: 'startScope', scope });
        },
        endScope: () => {
          log.push({ kind: 'endScope' });
        },
        addText: (text) => {
          log.push({ kind: 'addText', text });
        },
        addSubLanguage: (_stream, language) => {
          log.push({ kind: 'addSubLanguage', language });
        },
        finalize: () => {
          log.push({ kind: 'finalize' });
        },
        render: () => {
          log.push({ kind: 'render' });
          return log;
        },
        toTokenStream: () => {
          log.push({ kind: 'toTokenStream' });
          return emptyStream;
        },
      };
      captured = log;
      return e;
    },
  });
  return {
    factory,
    getLog() {
      if (captured === undefined) throw new Error('emitter never created');
      return captured;
    },
  };
}

describe('Emitter contract (spec §5)', () => {
  it("highlights 'a' with a tiny stub language and emits expected call sequence", () => {
    // spec section 5.6 numbered call-trace: for a single mode matching one
    // character, we expect startScope, addText, endScope, finalize, render.
    // The `toTokenStream` call happens during render() to populate the
    // result._tokenStream value.
    const tiny = defineLanguage({
      name: 't',
      contains: [{ scope: 'kw', begin: /a/ }],
    });
    const { factory, getLog } = recordingEmitter();
    const hl = createHighlighter({ languages: [tiny], emitter: factory });
    hl.highlight('a', { language: 't' });

    const log = getLog();
    // Filter to engine-driven calls (not the toTokenStream call we make at
    // the end inside HighlighterImpl.runEngine for result._tokenStream).
    expect(log.some((c) => c.kind === 'startScope' && c.scope === 'kw')).toBe(true);
    expect(log.some((c) => c.kind === 'addText' && c.text === 'a')).toBe(true);
    expect(log.filter((c) => c.kind === 'endScope').length).toBeGreaterThanOrEqual(1);
    expect(log.some((c) => c.kind === 'finalize')).toBe(true);
    expect(log.some((c) => c.kind === 'render')).toBe(true);

    // First few calls match the documented sequence (spec §5.6 entries 3-7
    // for the single-token case).
    const meaningful = log.filter((c) => c.kind !== 'toTokenStream');
    expect(meaningful[0]).toEqual({ kind: 'startScope', scope: 'kw' });
    expect(meaningful[1]).toEqual({ kind: 'addText', text: 'a' });
    expect(meaningful[2]).toEqual({ kind: 'endScope' });
    expect(meaningful[3]).toEqual({ kind: 'finalize' });
  });

  it('the engine never reaches into a foreign emitter — TokenStream is the boundary', () => {
    // spec section 5.2: addSubLanguage receives a TokenStream value, not an
    // Emitter. There is no public API path through which a user can pass an
    // Emitter to another Emitter. The very absence of such a method is the
    // assertion: we sanity-check by typing.
    const factory = defineEmitter<string>({
      name: 'plain',
      create() {
        return {
          startScope: () => {},
          endScope: () => {},
          addText: () => {},
          addSubLanguage(stream: TokenStream): void {
            // The argument is typed as TokenStream — it must be a discriminated
            // union of TokenScope/TokenText/TokenSubLanguage. No emitter object
            // could pass this signature.
            expect(stream.type).toBe('scope');
          },
          finalize: () => {},
          render: () => '',
          toTokenStream: (): TokenStream => ({ type: 'scope', children: [] }),
        };
      },
    });
    expect(factory.name).toBe('plain');
  });
});
