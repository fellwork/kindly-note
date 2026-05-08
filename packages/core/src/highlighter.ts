// Highlighter — registry, plugin pipeline runner, public API entry point.
// spec section 0 (architectural shifts), section 2 (plugin pipeline),
// section 9 (compilation timing).

import type { CompiledLanguage } from './compile.js';
import { compileLanguage } from './compile.js';
import type { Emitter, EmitterFactory, TokenStream } from './emitter.js';
import { IllegalSyntaxError, LanguageNotFoundError } from './errors.js';
import { runMatcher } from './internal/matcher.js';
import { defaultRecordingEmitter } from './internal/recording-emitter.js';
import type { LanguageDefinition } from './language.js';
import type {
  HighlighterReadonly,
  HighlighterReadonlyOptions,
  Plugin,
  PluginContext,
  PluginLogger,
} from './plugin.js';
import { defaultPluginLogger, runHook } from './plugin.js';
import type { CodeInput, HighlightOptions, HighlightResult } from './result.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for createHighlighter. spec section 7.3 capability table. */
export interface HighlighterOptions {
  /** Languages to register up-front. Each is a deep-frozen LanguageDefinition. */
  readonly languages?: readonly LanguageDefinition<unknown>[];
  /** Plugins to register up-front. spec section 2. */
  readonly plugins?: readonly Plugin[];
  /** CSS class prefix. Default 'kn-'. spec section 0 #6. */
  readonly classPrefix?: string;
  /** Default error-handling mode. spec section 2.4. */
  readonly errorMode?: 'safe' | 'throw';
  /** DOM selector for highlightAll-style auto-init (consumed by @kindly-note/browser). */
  readonly cssSelector?: string;
  /** Whether to silently accept un-escaped HTML in code blocks. spec section 7.3. */
  readonly ignoreUnescapedHTML?: boolean;
  /** The emitter factory. Defaults to a built-in recording emitter for tests. */
  readonly emitter?: EmitterFactory<unknown>;
  /** Custom logger factory; defaults to console-based. */
  readonly logger?: (pluginName: string) => PluginLogger;
}

/**
 * The handle returned by registerLanguage. Holds the deep-frozen LanguageDefinition
 * and the immutable CompiledLanguage snapshot taken at register time.
 *
 * spec section 9.1: the snapshot guarantees a later mutation of `def` (TypeScript
 * cannot fully prevent this in a downcast) does not affect this handle.
 */
export interface RegisteredLanguage {
  readonly definition: LanguageDefinition<unknown>;
  readonly compiled: CompiledLanguage;
}

/**
 * The public Highlighter contract. spec section 7.3 capability migration table.
 */
export interface Highlighter {
  highlight(code: string, options: HighlightOptions): HighlightResult;
  registerLanguage(def: LanguageDefinition<unknown>): RegisteredLanguage;
  getLanguage(nameOrAlias: string): RegisteredLanguage | undefined;
  listLanguages(): readonly string[];
  use(plugin: Plugin): void;
  unuse(plugin: Plugin): void;
  readonly options: HighlighterReadonlyOptions;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

class HighlighterImpl implements Highlighter {
  // spec section 9.1: registry maps every alias and the canonical name to the
  // SAME RegisteredLanguage handle. The compiled snapshot is fresh per register.
  private readonly registry = new Map<string, RegisteredLanguage>();
  private readonly canonicalNames = new Set<string>();
  private readonly plugins: Plugin[] = [];

  readonly options: HighlighterReadonlyOptions;
  private readonly emitterFactory: EmitterFactory<unknown>;
  private readonly loggerFactory: (name: string) => PluginLogger;

  constructor(opts: HighlighterOptions) {
    this.options = Object.freeze({
      classPrefix: opts.classPrefix ?? 'kn-', // spec section 0 #6
      errorMode: opts.errorMode ?? 'safe', // spec section 2.4 default
      ignoreUnescapedHTML: opts.ignoreUnescapedHTML ?? true,
      cssSelector: opts.cssSelector ?? 'pre code',
    });
    this.emitterFactory = opts.emitter ?? defaultRecordingEmitter;
    this.loggerFactory = opts.logger ?? defaultPluginLogger;

    for (const lang of opts.languages ?? []) this.registerLanguage(lang);
    for (const plugin of opts.plugins ?? []) this.use(plugin);
  }

  registerLanguage(def: LanguageDefinition<unknown>): RegisteredLanguage {
    // spec section 9.1: compile-at-register-time. The compiled artifact is a
    // snapshot; later mutations of `def` (only possible if the caller
    // bypassed defineLanguage) do not affect this handle.
    const compiled = compileLanguage(def);
    const handle: RegisteredLanguage = Object.freeze({ definition: def, compiled });
    this.canonicalNames.add(def.name);
    this.registry.set(def.name, handle);
    // Lower-cased alias resolution mirrors upstream: spec section 7.3 capability
    // table, "Language aliases".
    this.registry.set(def.name.toLowerCase(), handle);
    for (const alias of def.aliases ?? []) {
      this.registry.set(alias, handle);
      this.registry.set(alias.toLowerCase(), handle);
    }
    return handle;
  }

  getLanguage(nameOrAlias: string): RegisteredLanguage | undefined {
    return this.registry.get(nameOrAlias) ?? this.registry.get(nameOrAlias.toLowerCase());
  }

  listLanguages(): readonly string[] {
    return [...this.canonicalNames];
  }

  use(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  unuse(plugin: Plugin): void {
    const idx = this.plugins.indexOf(plugin);
    if (idx >= 0) this.plugins.splice(idx, 1);
  }

  highlight(code: string, options: HighlightOptions): HighlightResult {
    let input: CodeInput = {
      code,
      language: options.language,
      ignoreIllegals: options.ignoreIllegals ?? false,
    };

    // Each highlight call gets fresh per-plugin contexts. spec section 2.3.
    const ctxByPlugin = new WeakMap<Plugin, PluginContext>();
    const getCtx = (plugin: Plugin): PluginContext => {
      let ctx = ctxByPlugin.get(plugin);
      if (ctx !== undefined) return ctx;
      ctx = {
        highlighter: this.readonlyView(),
        state: new Map<string, unknown>(),
        log: this.loggerFactory(plugin.name),
      };
      ctxByPlugin.set(plugin, ctx);
      return ctx;
    };

    // Phase 1: transformCode
    for (const plugin of this.plugins) {
      if (plugin.transformCode === undefined) continue;
      const hook = plugin.transformCode.bind(plugin);
      input = runHook(
        plugin,
        'transformCode',
        hook,
        input,
        getCtx(plugin),
        this.options.errorMode,
        input,
      );
    }

    // Phase 2: shortCircuit
    let result: HighlightResult | undefined;
    for (const plugin of this.plugins) {
      if (plugin.shortCircuit === undefined) continue;
      const hook = plugin.shortCircuit.bind(plugin);
      const sc = runHook<CodeInput, HighlightResult | undefined>(
        plugin,
        'shortCircuit',
        hook,
        input,
        getCtx(plugin),
        this.options.errorMode,
        undefined,
      );
      if (sc !== undefined) {
        result = sc;
        break;
      }
    }

    // Phase 3: actual highlight if no short-circuit.
    if (result === undefined) result = this.runEngine(input);

    // Phase 4: transformResult
    for (const plugin of this.plugins) {
      if (plugin.transformResult === undefined) continue;
      const hook = plugin.transformResult.bind(plugin);
      result = runHook(
        plugin,
        'transformResult',
        hook,
        result,
        getCtx(plugin),
        this.options.errorMode,
        result,
      );
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private runEngine(input: CodeInput): HighlightResult {
    const handle = this.getLanguage(input.language);
    if (handle === undefined) {
      if (this.options.errorMode === 'throw') {
        throw new LanguageNotFoundError(input.language);
      }
      // 'safe' fallback: produce an inert result that contains the raw input.
      // The recording emitter still produces a valid TokenStream.
      const emitter = this.emitterFactory.create({
        classPrefix: this.options.classPrefix,
        language: input.language,
      });
      emitter.addText(input.code);
      emitter.finalize();
      return Object.freeze({
        value: emitter.render() as string,
        relevance: 0,
        illegal: false,
        code: input.code,
        _tokenStream: emitter.toTokenStream(),
      });
    }

    const emitter = this.emitterFactory.create({
      classPrefix: this.options.classPrefix,
      language: handle.compiled.name,
    });

    // Sub-language recursion callback. Spec section 5.7. When a mode declares
    // `subLanguage: 'foo'`, the matcher invokes this with the buffered text
    // and 'foo'; we run the engine recursively with a fresh emitter, finalize
    // it, and hand the resulting frozen TokenStream back to the parent
    // emitter. The parent never sees a foreign emitter object.
    const runSubLanguage = (
      subCode: string,
      subLangName: string,
    ): { stream: TokenStream; language: string; relevance: number } | undefined => {
      const subHandle = this.getLanguage(subLangName);
      if (subHandle === undefined) return undefined;
      const subEmitter = this.emitterFactory.create({
        classPrefix: this.options.classPrefix,
        language: subHandle.compiled.name,
      });
      const subResult = this.driveMatcher(subHandle.compiled, subCode, subEmitter, false);
      subEmitter.finalize();
      return {
        stream: subEmitter.toTokenStream(),
        language: subHandle.compiled.name,
        relevance: subResult.relevance,
      };
    };

    const r = this.driveMatcher(
      handle.compiled,
      input.code,
      emitter,
      input.ignoreIllegals,
      runSubLanguage,
    );
    emitter.finalize();

    const value = emitter.render();
    return Object.freeze({
      value: typeof value === 'string' ? value : '',
      relevance: r.relevance,
      illegal: r.illegal,
      language: handle.compiled.name,
      code: input.code,
      _tokenStream: emitter.toTokenStream(),
    });
  }

  /**
   * Run the matcher with illegal-rule handling. Wraps `runMatcher` to catch
   * `IllegalSyntaxError` and convert it into `result.illegal: true` per spec
   * section 2.2 (HighlightResult.illegal). When `errorMode === 'throw'` and
   * `ignoreIllegals === false`, the error propagates unchanged.
   */
  private driveMatcher(
    compiled: CompiledLanguage,
    code: string,
    emitter: Emitter<unknown>,
    ignoreIllegals: boolean,
    runSubLanguage?: (
      code: string,
      lang: string,
    ) => { stream: TokenStream; language: string; relevance: number } | undefined,
  ): { relevance: number; illegal: boolean } {
    try {
      return runMatcher(compiled, code, emitter, {
        ignoreIllegals,
        ...(runSubLanguage !== undefined ? { runSubLanguage } : {}),
      });
    } catch (err) {
      if (err instanceof IllegalSyntaxError) {
        if (this.options.errorMode === 'throw' && !ignoreIllegals) {
          throw err;
        }
        // Convert to a non-throwing illegal-marked result. The emitter has
        // already received whatever calls happened before the illegal point;
        // we DO NOT clear them — the partial output is preserved and the
        // result.illegal flag signals the truncation.
        return { relevance: 0, illegal: true };
      }
      throw err;
    }
  }

  private readonlyView(): HighlighterReadonly {
    const self = this;
    return Object.freeze({
      getLanguage(name: string) {
        const h = self.getLanguage(name);
        return h !== undefined ? { name: h.compiled.name } : undefined;
      },
      listLanguages: () => self.listLanguages(),
      options: self.options,
    });
  }
}

/** Construct a Highlighter. spec section 7.3, section 1.2 example. */
export function createHighlighter(opts: HighlighterOptions = {}): Highlighter {
  return new HighlighterImpl(opts);
}
