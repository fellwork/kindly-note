// Typed error classes for kindly-note. spec §10 ties to Scout Q11
// (errorMode: 'safe' | 'throw' replaces upstream's debugMode/safeMode).
//
// Spec note: this module is exported as the `@kindly-note/core/errors` subpath
// (spec §6.4). Importers can pull just the classes without dragging in the full engine.

/** Base class — every kindly-note-thrown error inherits from here. */
export class KindlyNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KindlyNoteError';
  }
}

/** Thrown when a caller asks for a language that isn't registered. */
export class LanguageNotFoundError extends KindlyNoteError {
  readonly language: string;
  constructor(language: string) {
    super(`Unknown language: "${language}"`);
    this.name = 'LanguageNotFoundError';
    this.language = language;
  }
}

/** Thrown when the parser hits an `illegal` rule and the highlighter is in throw mode. */
export class IllegalSyntaxError extends KindlyNoteError {
  readonly language: string;
  readonly index: number;
  constructor(language: string, index: number, context: string) {
    super(`Illegal lexeme in "${language}" at index ${index}: ${context}`);
    this.name = 'IllegalSyntaxError';
    this.language = language;
    this.index = index;
  }
}

/** Thrown when a language definition fails compile-time validation. */
export class LanguageCompileError extends KindlyNoteError {
  readonly language: string;
  constructor(language: string, detail: string) {
    super(`Failed to compile language "${language}": ${detail}`);
    this.name = 'LanguageCompileError';
    this.language = language;
  }
}

/**
 * Thrown when extendLanguage() is called against a parent that did not declare
 * `extensible`. spec §8.2: a language must opt in to being extended.
 */
export class LanguageNotExtensibleError extends KindlyNoteError {
  readonly parentName: string;
  constructor(parentName: string) {
    super(
      `Cannot extend language "${parentName}": it does not declare an \`extensible\` surface. See spec §8.2 — the parent must publish a typed extensible: T to allow extendLanguage().`,
    );
    this.name = 'LanguageNotExtensibleError';
    this.parentName = parentName;
  }
}

/**
 * Thrown by a `LanguageLoader` when it cannot resolve a language identifier,
 * the underlying transport (fetch / dynamic import) fails, or the loaded
 * artifact has the wrong shape. spec §4.2.1 / §4.2.3.
 *
 * Both v0 loader packages (`@kindly-note/loader-dynamic-import`,
 * `@kindly-note/loader-fetch`) wrap their underlying failures in this class
 * so callers can branch on a single error type. The original cause is
 * preserved in `cause` for diagnostics.
 */
export class LanguageLoadError extends KindlyNoteError {
  readonly specifier: string;
  override readonly cause: unknown;
  constructor(specifier: string, detail: string, cause?: unknown) {
    super(`Failed to load language "${specifier}": ${detail}`);
    this.name = 'LanguageLoadError';
    this.specifier = specifier;
    this.cause = cause;
  }
}

/**
 * Wraps a thrown error from a plugin hook so logs include both the plugin name
 * and the original cause. The engine throws this only when errorMode is 'throw'
 * (spec §2.4); under 'safe' mode the original error is logged and the plugin is
 * skipped.
 */
export class PluginError extends KindlyNoteError {
  readonly pluginName: string;
  readonly phase: string;
  override readonly cause: unknown;
  constructor(pluginName: string, phase: string, cause: unknown) {
    super(`plugin "${pluginName}" threw in ${phase}`);
    this.name = 'PluginError';
    this.pluginName = pluginName;
    this.phase = phase;
    this.cause = cause;
  }
}
