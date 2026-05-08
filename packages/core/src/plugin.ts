// Plugin protocol — spec section 2 normative.
//
// Pure-function pipeline; no shared mutable context; per-phase tree-shakable;
// per-plugin error-isolated. spec section 2.1.

import type { CodeInput, ElementInput, ElementOutput, HighlightResult } from './result.js';

/**
 * The Highlighter view exposed to plugins. Read-only on purpose: a plugin
 * may inspect registered languages and the highlighter's options but cannot
 * mutate them. spec section 2.2 (PluginContext.highlighter).
 */
export interface HighlighterReadonly {
  /** Look up a registered language by canonical name or alias. */
  getLanguage(name: string): { readonly name: string } | undefined;
  /** List of canonical language names registered with this highlighter. */
  listLanguages(): readonly string[];
  /** Read-only options. */
  readonly options: HighlighterReadonlyOptions;
}

export interface HighlighterReadonlyOptions {
  readonly classPrefix: string;
  readonly errorMode: 'safe' | 'throw';
  readonly ignoreUnescapedHTML: boolean;
  readonly cssSelector: string;
}

/** Logger scoped to a single plugin's name. spec section 2.2. */
export interface PluginLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Per-call PluginContext. Fresh per highlight() invocation. Plugins MUST NOT
 * cache cross-call state on `ctx`; module-scoped state is fine. spec section 2.3.
 */
export interface PluginContext {
  readonly highlighter: HighlighterReadonly;
  readonly state: Map<string, unknown>;
  readonly log: PluginLogger;
}

/**
 * The plugin contract. All hooks are optional. spec section 2.2 normative.
 *
 * Hooks return new values; they do NOT mutate the input. The engine threads
 * the return value of plugin N into plugin N+1.
 */
export interface Plugin {
  /** Diagnostic name. Required. Appears in error messages and dev-mode logs. */
  readonly name: string;
  /** Semver of the kindly-note core API the plugin was authored against. */
  readonly apiVersion: string;

  /** Phase 1: transform code/language before the engine runs. */
  transformCode?(input: CodeInput, ctx: PluginContext): CodeInput;

  /** Phase 2: short-circuit by returning a complete HighlightResult, or undefined to continue. */
  shortCircuit?(input: CodeInput, ctx: PluginContext): HighlightResult | undefined;

  /** Phase 3: transform the result after highlighting. */
  transformResult?(result: HighlightResult, ctx: PluginContext): HighlightResult;

  /** Phase 4: DOM-element pre-hook. Used by @kindly-note/browser only. */
  beforeElement?(input: ElementInput, ctx: PluginContext): ElementInput;

  /** Phase 5: DOM-element post-hook. Used by @kindly-note/browser only. */
  afterElement?(input: ElementOutput, ctx: PluginContext): void;
}

/** Identity factory for type inference. spec section 2.2. */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

// ---------------------------------------------------------------------------
// Pipeline runner
// ---------------------------------------------------------------------------

import { PluginError } from './errors.js';

/**
 * Run a plugin hook with error isolation. spec section 2.4.
 *
 * In 'safe' mode (default), thrown errors are logged and the plugin's
 * contribution is dropped — the previous value passes through unchanged. In
 * 'throw' mode, the error escapes wrapped in a PluginError so callers can
 * inspect plugin name + phase + cause.
 */
export function runHook<TIn, TOut>(
  plugin: Plugin,
  phase: 'transformCode' | 'shortCircuit' | 'transformResult' | 'beforeElement' | 'afterElement',
  hook: (input: TIn, ctx: PluginContext) => TOut,
  input: TIn,
  ctx: PluginContext,
  errorMode: 'safe' | 'throw',
  passthrough: TOut,
): TOut {
  try {
    return hook(input, ctx);
  } catch (err) {
    ctx.log.error(`plugin "${plugin.name}" threw in ${phase}`, err);
    if (errorMode === 'throw') {
      throw new PluginError(plugin.name, phase, err);
    }
    return passthrough;
  }
}

/**
 * Build a logger that prefixes every message with the plugin's name.
 * Default impl uses console.* — the engine may override with a custom sink
 * via createHighlighter({ logger: ... }) once that option lands (out of v0).
 */
export function defaultPluginLogger(name: string): PluginLogger {
  // We capture the global console at construction time so test environments
  // can stub it without the closure escaping. We narrow the global lookup
  // through `unknown` because the core tsconfig does NOT include the DOM lib;
  // `console` is part of the @types/node lib and we are runtime-neutral.
  interface MinimalConsole {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  }
  const c = (globalThis as unknown as { console: MinimalConsole }).console;
  return {
    debug: (...args) => c.debug(`[kn:${name}]`, ...args),
    info: (...args) => c.info(`[kn:${name}]`, ...args),
    warn: (...args) => c.warn(`[kn:${name}]`, ...args),
    error: (...args) => c.error(`[kn:${name}]`, ...args),
  };
}
