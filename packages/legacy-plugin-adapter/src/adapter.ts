// Legacy-plugin adapter — spec §3 normative.
//
// This file maps each of the six upstream `before:* / after:*` hooks
// (Scout §2 verbatim) onto the modern Plugin protocol (spec §2). The full
// hook→phase mapping is the table in spec §3.3:
//
//   | Legacy hook                | Modern phase                          |
//   |----------------------------|---------------------------------------|
//   | before:highlight           | transformCode + shortCircuit          |
//   | after:highlight            | transformResult                       |
//   | before:highlightElement    | beforeElement                         |
//   | after:highlightElement     | afterElement                          |
//   | before:highlightBlock      | (deprecated alias) → beforeElement    |
//   | after:highlightBlock       | (deprecated alias) → afterElement     |
//
// Mutation semantics from upstream are preserved INSIDE this adapter; the
// modern protocol (§2) sees only pure transforms.

import type {
  CodeInput,
  ElementInput,
  ElementOutput,
  HighlightResult,
  Plugin,
  PluginContext,
} from '@kindly-note/core';

import type {
  LegacyAfterHighlightBlockData,
  LegacyAfterHighlightElementData,
  LegacyBeforeHighlightBlockData,
  LegacyBeforeHighlightContext,
  LegacyBeforeHighlightElementData,
  LegacyHLJSPlugin,
} from './types.js';

// State key for stashing the `before:highlight` short-circuit result between
// the modern `transformCode` and `shortCircuit` phases on a single call. spec
// §3.4: "The adapter holds a closure-scoped key … capturing the mutated
// context object across `transformCode` → `shortCircuit` for the same call.
// The engine guarantees `ctx` is the same reference for both phases of a
// single call." We use the per-plugin per-call `PluginContext.state` Map for
// this — a clean alternative to the WeakMap sketched in the spec, with
// identical semantics. PluginContext.state is fresh per highlight() call
// (highlighter.ts line 149), so no cross-call leak.
const SHORT_CIRCUIT_STATE_KEY = '@kindly-note/legacy-plugin-adapter:shortCircuit';

interface ShortCircuitSlot {
  /** True when before:highlight ran for this call (so shortCircuit knows not to re-run). */
  ran: true;
  /** The result the legacy plugin set on `ctx.result`, if any. */
  result: HighlightResult | undefined;
}

/**
 * Wrap an upstream-shaped `LegacyHLJSPlugin` (six legacy hooks, mutating-arg
 * dispatch) into a modern `Plugin` (pure transforms, per-phase tree-shaking,
 * per-plugin error isolation). spec §3.2.
 *
 * The returned `Plugin` only declares the modern phases it actually needs
 * (per-phase tree-shaking, spec §2.7). For example, a legacy plugin that only
 * sets `after:highlight` produces a modern Plugin with only `transformResult`
 * defined — the other phases are absent and the engine skips them at zero
 * cost.
 *
 * @param legacy The upstream plugin object. Only the hooks it actually sets
 *   are honored; missing hooks are no-ops.
 * @param name Optional diagnostic name. The returned modern plugin's
 *   `Plugin.name` is `legacy:<name>`. Defaults to `'legacy'`.
 */
export function adaptLegacyPlugin(legacy: LegacyHLJSPlugin, name = 'legacy'): Plugin {
  // spec §3.4: pre-upgrade deprecated `*:highlightBlock` hooks. Mirrors
  // upstream's `upgradePluginAPI` (Scout §2, `src/highlight.js:934-958`).
  // We avoid mutating the caller's plugin object; clone first.
  const upgraded: LegacyHLJSPlugin = { ...legacy };

  if (
    upgraded['before:highlightBlock'] !== undefined &&
    upgraded['before:highlightElement'] === undefined
  ) {
    const blockHook = upgraded['before:highlightBlock'];
    upgraded['before:highlightElement'] = (data: LegacyBeforeHighlightElementData) => {
      const blockArg: LegacyBeforeHighlightBlockData = { block: data.el, language: data.language };
      blockHook(blockArg);
      // Mirror upstream upgradePluginAPI semantics: when the deprecated hook
      // mutates `block.language`, the upgrade shim feeds that mutation back
      // into the modern `data.language` field so downstream code sees it.
      data.language = blockArg.language;
    };
  }

  if (
    upgraded['after:highlightBlock'] !== undefined &&
    upgraded['after:highlightElement'] === undefined
  ) {
    const blockHook = upgraded['after:highlightBlock'];
    upgraded['after:highlightElement'] = (data: LegacyAfterHighlightElementData) => {
      const blockArg: LegacyAfterHighlightBlockData = {
        block: data.el,
        result: data.result,
        text: data.text,
      };
      blockHook(blockArg);
    };
  }

  // Build the modern Plugin object. Only declare the phases we need so
  // per-phase tree-shaking (spec §2.7) is preserved.
  const adapted: Plugin = {
    name: `legacy:${name}`,
    apiVersion: '1',
  };

  // -------------------------------------------------------------------------
  // before:highlight → transformCode + shortCircuit (spec §3.3 row 1)
  // -------------------------------------------------------------------------
  const beforeHighlight = upgraded['before:highlight'];
  if (beforeHighlight !== undefined) {
    adapted.transformCode = (input: CodeInput, ctx: PluginContext): CodeInput => {
      const legacyCtx: LegacyBeforeHighlightContext = {
        code: input.code,
        language: input.language,
      };
      // Run the legacy hook with a mutable context object; faithfully
      // preserve in-place mutation semantics from upstream's `fire()`
      // dispatch (Scout §2).
      beforeHighlight(legacyCtx);

      // Stash any short-circuit result for the shortCircuit phase to read.
      // PluginContext.state is per-plugin, per-call (highlighter.ts).
      const slot: ShortCircuitSlot = { ran: true, result: legacyCtx.result };
      ctx.state.set(SHORT_CIRCUIT_STATE_KEY, slot);

      return {
        code: legacyCtx.code,
        language: legacyCtx.language,
        ignoreIllegals: input.ignoreIllegals,
      };
    };

    adapted.shortCircuit = (_input: CodeInput, ctx: PluginContext): HighlightResult | undefined => {
      const slot = ctx.state.get(SHORT_CIRCUIT_STATE_KEY) as ShortCircuitSlot | undefined;
      // If transformCode threw and was swallowed by safe-mode error
      // isolation (spec §2.4), `slot` is undefined and we conservatively do
      // nothing here.
      if (slot === undefined) return undefined;
      return slot.result;
    };
  }

  // -------------------------------------------------------------------------
  // after:highlight → transformResult (spec §3.3 row 2)
  // -------------------------------------------------------------------------
  const afterHighlight = upgraded['after:highlight'];
  if (afterHighlight !== undefined) {
    adapted.transformResult = (result: HighlightResult): HighlightResult => {
      // Construct a shallow mutable copy. The legacy plugin mutates this
      // copy; the adapter returns the mutated object as the new immutable
      // result for the next plugin in the modern pipeline. spec §3.4.
      //
      // We strip `readonly` by spreading into a new object literal.
      const mutable = { ...result } as {
        -readonly [K in keyof HighlightResult]: HighlightResult[K];
      };
      afterHighlight(mutable as HighlightResult);
      return mutable as HighlightResult;
    };
  }

  // -------------------------------------------------------------------------
  // before:highlightElement → beforeElement (spec §3.3 row 3)
  // -------------------------------------------------------------------------
  const beforeElement = upgraded['before:highlightElement'];
  if (beforeElement !== undefined) {
    adapted.beforeElement = (input: ElementInput): ElementInput => {
      const data: LegacyBeforeHighlightElementData = {
        el: input.el as Element,
        language: input.language,
      };
      beforeElement(data);
      return { el: input.el, language: data.language };
    };
  }

  // -------------------------------------------------------------------------
  // after:highlightElement → afterElement (spec §3.3 row 4)
  // -------------------------------------------------------------------------
  const afterElement = upgraded['after:highlightElement'];
  if (afterElement !== undefined) {
    adapted.afterElement = (input: ElementOutput): void => {
      // Pass a shallow copy of `result` so legacy `result.value` mutations
      // do not leak back into the immutable HighlightResult held by the
      // engine. The DOM element itself is by-reference (the legacy plugin
      // expects to read/write `el.innerHTML` directly).
      const data: LegacyAfterHighlightElementData = {
        el: input.el as Element,
        result: { ...input.result },
        text: input.text,
      };
      afterElement(data);
    };
  }

  return adapted;
}
