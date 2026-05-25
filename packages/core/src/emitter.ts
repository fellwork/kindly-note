// Emitter abstraction. spec section 5 normative.
//
// Critical design: parent emitters never see a foreign emitter's internals.
// They receive a typed TokenStream value (spec section 5.2). This eliminates
// the upstream __addSublanguage(emitter) leak where parent reads child.root.

// ---------------------------------------------------------------------------
// EmitterFactory + Emitter contracts
// ---------------------------------------------------------------------------

/**
 * Author-facing factory shape. spec section 5.1 normative.
 *
 * Type parameter `TOutput` is the rendered output type (string for HTML,
 * hast Root for hast, TokenStream for ast, etc.).
 */
export interface EmitterFactory<TOutput> {
  readonly name: string;
  create(opts: EmitterOptions): Emitter<TOutput>;
}

/** Per-call options threaded by the engine into an emitter instance. */
export interface EmitterOptions {
  readonly classPrefix: string;
  readonly language: string;
  readonly emitterConfig?: unknown;
}

/**
 * The six-method emitter contract. spec section 5.1.
 *
 * Engine call order: zero-or-more (startScope|startScopeWithAttrs|endScope|
 * addText|addSubLanguage), then exactly one finalize(), then exactly one
 * render(). The engine may also call toTokenStream() *before* render() when
 * this emitter was created for a sub-language and the parent needs its tokens.
 */
export interface Emitter<TOutput> {
  startScope(scope: string): void;
  /**
   * Open a scope that carries attributes. spec section 13.3a (decision (a)).
   *
   * OPTIONAL — added in core 0.2.0 as a backward-compatible minor. Emitters
   * that produce attribute-bearing markup (`@kindly-note/emitters-markdown`'s
   * `<a href>`, `<h1 id>`, `<img src alt>`; `@kindly-note/emitters-hast`)
   * implement this. Emitters that only produce `<span class>` output
   * (`@kindly-note/emitters-html`, the recording emitter) MAY omit it — the
   * engine and any attribute-aware language definition call this method only
   * when it exists, otherwise they fall back to {@link Emitter.startScope}.
   *
   * The `attrs` payload is a flat, already-decided `Record<string, string>`.
   * It is the producer's responsibility (matcher / language definition) to
   * decide which attributes to carry; it is the emitter's responsibility to
   * decide how (or whether) to serialize them safely.
   *
   * Each `startScopeWithAttrs` MUST be balanced by exactly one
   * {@link Emitter.endScope}, identical to {@link Emitter.startScope}.
   */
  startScopeWithAttrs?(scope: string, attrs: Readonly<Record<string, string>>): void;
  endScope(): void;
  addText(text: string): void;
  addSubLanguage(stream: TokenStream, language: string): void;
  finalize(): void;
  render(): TOutput;
  /**
   * Produce the canonical TokenStream — used by the engine when this emitter
   * is the output of a sub-language highlight. spec section 5.1.
   */
  toTokenStream(): TokenStream;
}

/**
 * Identity factory. Mirrors definePlugin / defineLanguage. Mostly here for
 * symmetry and downstream type inference.
 */
export function defineEmitter<TOutput>(factory: EmitterFactory<TOutput>): EmitterFactory<TOutput> {
  return factory;
}

// ---------------------------------------------------------------------------
// TokenStream value type — spec section 5.2 normative
// ---------------------------------------------------------------------------

/** The lingua franca for sub-language data. JSON-serializable. */
export type TokenStream = TokenScope;

export type TokenNode = TokenScope | TokenText | TokenSubLanguage;

/** A literal text run. */
export interface TokenText {
  readonly type: 'text';
  readonly text: string;
}

/** A scoped node — equivalent to one open/close pair on the emitter contract. */
export interface TokenScope {
  readonly type: 'scope';
  readonly scope?: string;
  readonly children: readonly TokenNode[];
}

/**
 * A sub-language insertion. Carries the inserted stream verbatim plus the
 * language name. spec section 5.2 lifts subLanguage onto the TokenScope; we
 * promote it to its own variant for type-narrowing convenience.
 */
export interface TokenSubLanguage {
  readonly type: 'sub-language';
  readonly language: string;
  readonly stream: TokenStream;
}
