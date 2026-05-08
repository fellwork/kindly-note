// `highlightElement(el, hl, options?)` — highlight a single DOM element.
//
// spec §1.2 row `@kindly-note/browser`: this is one of three exports.
// spec §7.1.5: migration target for upstream's `hljs.highlightElement(el)`.
// Scout §11 (do-not-break list): post-conditions on `el.dataset.highlighted`,
// `el.result`, `el.secondBest` are preserved verbatim from upstream.
// spec §2 (modern plugin protocol): the `beforeElement` and `afterElement`
// phases fire from inside this function around the engine call.
//
// Implementation reference (NOT byte-copied): upstream's `highlightElement`
// at `src/highlight.js:743-800`. We share the post-conditions; we do not
// share code. The structural difference is that the engine and plugin
// pipeline live in `@kindly-note/core` and are passed in by reference.
//
// Security note on the DOM markup write: the highlighter's emitter is
// responsible for HTML-escaping every byte that came from user input —
// see `@kindly-note/emitters-html` `escape.ts`. The HighlightResult.value
// passed here is therefore safe-by-construction; writing it via the DOM's
// markup-parsing setter is the do-not-break contract from upstream
// (Scout §11) and the documented behaviour of `kindly-note`. If a future
// emitter produces non-string output (hast trees), the value falls
// through to `''` here and a separate DOM-aware emitter package would
// handle that binding.

import type {
  ElementInput,
  ElementOutput,
  HighlightResult,
  Highlighter,
  Plugin,
  PluginContext,
} from '@kindly-note/core';
import { defaultPluginLogger, runHook } from '@kindly-note/core';

import { languageFromClass } from './language-from-class.js';

/**
 * Minimal interface for an auto-detector. Type-only structural shape — the
 * browser package does NOT import `@kindly-note/auto-detect` directly. That
 * package is a peer-optional dependency (per package.json
 * `peerDependenciesMeta`) and is loaded by the caller. The caller passes
 * the detector handle in via options. spec §1.2 row.
 */
export interface AutoDetectorLike {
  detect(
    code: string,
    opts?: unknown,
  ): { language?: string; value: string; relevance: number; secondBest?: string };
}

/**
 * Options for `highlightElement`.
 */
export interface HighlightElementOptions {
  /**
   * Override language detection from class attribute. When provided, the
   * class attribute is NOT consulted. Useful when the calling app has
   * out-of-band knowledge (a Markdown front-matter, a syntax-server hint).
   */
  readonly language?: string;
  /**
   * If the language is unknown (no class match, no `language` option) and
   * an `autoDetector` is provided, run auto-detect. Default: `false`.
   * `false` matches upstream's behaviour: when no language is known and
   * auto-detect is not configured, `highlightElement` highlights with the
   * "no-highlight" / unknown-language fallback (the engine's safe-mode
   * passthrough writes the raw text back).
   */
  readonly autoDetect?: boolean;
  /**
   * The auto-detector to use when `autoDetect: true`. Construct via
   * `createAutoDetector(hl)` from `@kindly-note/auto-detect`.
   */
  readonly autoDetector?: AutoDetectorLike;
}

/**
 * The opaque marker we set on `el.dataset.highlighted` to signal that this
 * element has already been highlighted. We pick `'kindly-note'` rather than
 * upstream's `'yes'` so a page mid-migration can tell which engine wrote
 * the markup. spec §F (idempotence note) + Scout §11.
 */
export const KINDLY_NOTE_HIGHLIGHT_MARKER = 'kindly-note';

/**
 * Per-element highlight result attached to the DOM node. Mirrors the shape
 * upstream sets on `el.result` (Scout §11 + `src/highlight.js:786-791`).
 *
 * We expose this as a typed interface so callers can opt into the typing
 * with `(el as ElementWithHighlightResult).result`. We intentionally do NOT
 * augment the global `HTMLElement` interface from this package — that
 * would be cross-cutting type pollution.
 */
export interface ElementHighlightInfo {
  readonly language?: string;
  readonly relevance: number;
}

/**
 * Highlight a single DOM element. spec §7.1.5.
 *
 * Post-conditions (Scout §11):
 *   1. `el.textContent` is read as the source code (un-mutated).
 *   2. The element's HTML is replaced with the highlighted markup.
 *   3. `el.dataset.highlighted` is set to the kindly-note marker
 *      (`'kindly-note'`) — present === already highlighted.
 *   4. `(el as any).result` is set to `{ language, relevance }` — same shape
 *      as upstream `src/highlight.js:786-791` (the deprecated `re` alias is
 *      omitted; v0 cleanup).
 *   5. `(el as any).secondBest` is set IFF the auto-detector returned a
 *      runner-up (`language` field present in the detector's response).
 *   6. The highlighter's `beforeElement` plugin phase fires once before the
 *      engine call; `afterElement` fires once after the DOM mutation. Both
 *      are per-plugin error-isolated per spec §2.4.
 *
 * Idempotence (dispatch §D-8):
 *   This function checks `el.dataset.highlighted` and NO-OPs if it is
 *   already set. Calling `highlightElement` twice on the same element is
 *   safe and cheap. To re-highlight after a `textContent` change, the
 *   caller MUST clear the marker first:
 *     `delete (el as HTMLElement).dataset.highlighted;`
 *   This matches upstream behaviour at `src/highlight.js:753-756`.
 */
export function highlightElement(
  el: Element,
  hl: Highlighter,
  options: HighlightElementOptions = {},
): void {
  // We assume `el` is an HTMLElement at runtime; we narrow defensively for
  // callers passing a generic `Element` (e.g. from `querySelectorAll`).
  // `dataset` is typed as a property of `HTMLElement`, not `Element`.
  const htmlEl = el as HTMLElement;

  // Idempotence guard. spec §F + Scout §11. If the marker is already set,
  // we do nothing. Re-highlighting requires explicit caller action
  // (clear `dataset.highlighted`).
  if (htmlEl.dataset?.highlighted !== undefined) return;

  // ---------------------------------------------------------------------
  // 1. Language resolution
  // ---------------------------------------------------------------------
  // Priority: explicit option → class attribute → auto-detect (opt-in).
  // When all three miss, the engine receives an empty string and falls
  // through to its safe-mode unknown-language path (which is what upstream
  // does at `src/highlight.js:781` for `'no-highlight'`).
  const explicit = options.language;
  const fromClass = explicit === undefined ? languageFromClass(el) : undefined;
  let language: string | undefined = explicit ?? fromClass;

  // ---------------------------------------------------------------------
  // 2. beforeElement plugin phase (spec §2.2 + §3.3 row 3)
  // ---------------------------------------------------------------------
  // The plugin phase may MUTATE the language (by returning a new
  // ElementInput). We run the phase even when language is undefined so
  // plugins can populate it (e.g. a project-config plugin that picks the
  // language from a sibling DOM node).
  const text = el.textContent ?? '';
  const elementInput = runBeforeElement(hl, el, language ?? '');
  language = elementInput.language === '' ? undefined : elementInput.language;

  // ---------------------------------------------------------------------
  // 3. Highlight (engine call OR auto-detect)
  // ---------------------------------------------------------------------
  let result: HighlightResult;
  let detectedSecondBest: string | undefined;

  if (language !== undefined && language !== '' && hl.getLanguage(language) !== undefined) {
    // Direct path: the engine knows this language. Pass `ignoreIllegals: true`
    // because DOM-driven highlighting is a forgiving context — upstream does
    // the same at `src/highlight.js:781`.
    result = hl.highlight(text, { language, ignoreIllegals: true });
  } else if (options.autoDetect === true && options.autoDetector !== undefined) {
    const ad = options.autoDetector.detect(text);
    detectedSecondBest = ad.secondBest;
    if (ad.language !== undefined) {
      // Re-run through the engine using the detected language so plugins
      // (transformCode/transformResult) fire on this DOM call. The
      // detector itself runs through the engine internally, but its result
      // does not pass through this highlighter's transform pipeline.
      result = hl.highlight(text, { language: ad.language, ignoreIllegals: true });
      language = ad.language;
    } else {
      // Detector found nothing. Use its raw value (an empty-or-escaped
      // passthrough) as our result.
      result = Object.freeze({
        value: ad.value,
        relevance: ad.relevance,
        illegal: false,
        code: text,
      });
    }
  } else {
    // Unknown language, no detector. The engine's safe-mode unknown
    // language path produces an inert escaped result; reuse it so plugins
    // and DOM contract still see a HighlightResult. Pass through the
    // (empty) language string the engine knows how to handle.
    result = hl.highlight(text, {
      language: language ?? '',
      ignoreIllegals: true,
    });
  }

  // ---------------------------------------------------------------------
  // 4. Write the DOM
  // ---------------------------------------------------------------------
  // The highlight result's `value` is HTML-escaped by the emitter
  // (`@kindly-note/emitters-html`). Writing it through the DOM's markup-
  // parsing setter is the do-not-break contract (Scout §11).
  const html = typeof result.value === 'string' ? result.value : '';
  setMarkup(el, html);

  // Idempotence marker. spec §F.
  if (htmlEl.dataset !== undefined) {
    htmlEl.dataset.highlighted = KINDLY_NOTE_HIGHLIGHT_MARKER;
  }

  // Per-element typed result. We use Object.defineProperty with
  // enumerable: false so this property does not leak into JSON
  // serialisations of the DOM (which usually does not see custom DOM
  // properties anyway, but defence in depth).
  defineElementProp(htmlEl, 'result', {
    language: result.language ?? language,
    relevance: result.relevance,
  });

  if (detectedSecondBest !== undefined) {
    defineElementProp(htmlEl, 'secondBest', {
      language: detectedSecondBest,
      relevance: 0, // detector exposes name only; relevance lives on the inner highlight call
    });
  }

  // ---------------------------------------------------------------------
  // 5. afterElement plugin phase (spec §2.2 + §3.3 row 4)
  // ---------------------------------------------------------------------
  runAfterElement(hl, el, result, text);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace the element's contents with the given markup. The engine has
 * already escaped every input byte (`@kindly-note/emitters-html`); the
 * markup string is safe-by-construction. Encapsulating the assignment in
 * a one-liner helper keeps the call site tidy and gives us a single audit
 * point for the DOM-write contract (Scout §11).
 */
function setMarkup(el: Element, html: string): void {
  // Engine-emitted markup is HTML-escaped by emitters-html; writing it
  // through the DOM is the do-not-break contract from upstream Scout §11.
  const target = el as { innerHTML: string };
  target.innerHTML = html;
}

/**
 * Set a non-enumerable, configurable, writable property on the element. We
 * use `defineProperty` so the value is invisible to `for…in` and
 * `JSON.stringify` (the DOM doesn't serialise custom props through JSON,
 * but this is hygiene). `configurable: true` so callers can re-assign.
 */
function defineElementProp(el: HTMLElement, key: string, value: unknown): void {
  Object.defineProperty(el, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

/**
 * Iterate every plugin's `beforeElement` hook, threading the `ElementInput`
 * through. The engine's `highlight()` call already fires `transformCode`
 * and `transformResult` (spec §2.3). The browser package fires
 * `beforeElement` and `afterElement` (spec §2.2 phases 4 & 5) around the
 * engine call.
 *
 * To find the plugin list, we read the highlighter's internal `plugins`
 * array via a duck-typed cast. `@kindly-note/core` does not currently
 * expose a public read-only iterator over plugins; promoting it to a
 * public surface is the recommended next-cohort follow-up (see manifest).
 */
function runBeforeElement(
  hl: Highlighter,
  el: Element,
  language: string,
): { el: Element; language: string } {
  // ElementInput.el is typed as `unknown` in core (DOM-agnostic). We
  // narrow on the way out so callers in this file can keep working with
  // a typed `Element`.
  let current: ElementInput = { el, language };
  const plugins = readPlugins(hl);
  if (plugins.length === 0) return { el, language: current.language };

  for (const plugin of plugins) {
    if (plugin.beforeElement === undefined) continue;
    const ctx = makePluginContext(hl, plugin);
    current = runHook<ElementInput, ElementInput>(
      plugin,
      'beforeElement',
      plugin.beforeElement.bind(plugin),
      current,
      ctx,
      hl.options.errorMode,
      current,
    );
  }
  return { el: current.el as Element, language: current.language };
}

function runAfterElement(
  hl: Highlighter,
  el: Element,
  result: HighlightResult,
  text: string,
): void {
  const plugins = readPlugins(hl);
  if (plugins.length === 0) return;

  const input: ElementOutput = { el, result, text };
  for (const plugin of plugins) {
    if (plugin.afterElement === undefined) continue;
    const ctx = makePluginContext(hl, plugin);
    runHook<ElementOutput, void>(
      plugin,
      'afterElement',
      plugin.afterElement.bind(plugin),
      input,
      ctx,
      hl.options.errorMode,
      undefined,
    );
  }
}

/**
 * Build a per-call PluginContext. We mirror the engine's per-plugin context
 * construction (highlighter.ts:142-154). spec §2.2.
 */
function makePluginContext(hl: Highlighter, plugin: Plugin): PluginContext {
  const readonlyHl = {
    getLanguage(name: string) {
      const handle = hl.getLanguage(name);
      return handle !== undefined ? { name: handle.compiled.name } : undefined;
    },
    listLanguages: () => hl.listLanguages(),
    options: hl.options,
  };
  return {
    highlighter: readonlyHl,
    state: new Map<string, unknown>(),
    log: defaultPluginLogger(plugin.name),
  };
}

/**
 * Read the plugin list off the highlighter via a duck-typed internal
 * accessor. The HighlighterImpl in `@kindly-note/core` carries its plugin
 * array as a private field `plugins`; we read it through a typed cast.
 *
 * This is a v0-pragmatic coupling: the alternative is a public
 * `Highlighter.plugins` iterator, which is the right next-cohort follow-up
 * (noted in the build manifest).
 */
function readPlugins(hl: Highlighter): readonly Plugin[] {
  const internal = hl as unknown as { plugins?: readonly Plugin[] };
  return internal.plugins ?? [];
}
