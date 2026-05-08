// JavaScriptExtensionPoints — the typed extension surface published by
// @kindly-note/lang-javascript. Spec §1.2 row `@kindly-note/lang-javascript`:
// "Exposes typed `JavaScriptExtensionPoints` for downstream languages (TS,
// CoffeeScript, etc.) via `defineLanguage({ extensible: ... })`."
//
// Spec §8.2.1 worked example declares two extension points:
//   - PARAMS_CONTAINS: the contains-array used inside function-parameter
//     parsing. Descendants append to it (TypeScript adds DECORATOR; future
//     descendants may add type-annotation modes, default-value modes, etc.).
//   - CLASS_REFERENCE: the mode that matches a class reference (used in
//     `interface ... extends Foo` etc.).
//
// Spec §0 architectural shift #5: TypeScript inherits from JavaScript through
// the typed `extend()` API, not through array-mutation of an `exports` field.
// The shape declared here is what cohort 4's lang-typescript consumes via
// `extendLanguage(javascript, { extendPoints: { PARAMS_CONTAINS: ..., ... } })`.

import type { Mode } from '@kindly-note/core';

/**
 * The typed extension surface published by `@kindly-note/lang-javascript`.
 * Spec §1.2 mandates this be a `type` named export (not a `const`) so
 * downstream consumers (especially `@kindly-note/lang-typescript`) can satisfy
 * the parent's `extensible: T` constraint at the call site.
 *
 * Field choices follow upstream's `javascript.js#exports` shape:
 *   - PARAMS_CONTAINS: readonly Mode[] — exactly the contains-list TS extends
 *     in upstream's `tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR)`. We
 *     forbid the push-mutation by typing it as `readonly Mode[]`; descendants
 *     use `extendPoints.PARAMS_CONTAINS: (current) => [...current, DECORATOR]`.
 *   - CLASS_REFERENCE: Mode — the mode that scopes class references; TS uses
 *     it as `parentRefs.CLASS_REFERENCE` inside its `INTERFACE_MODE`'s contains
 *     (spec §8.2.2 worked example).
 */
export interface JavaScriptExtensionPoints {
  /**
   * The contains-array used inside function-parameter parsing. Descendants
   * append to it (TypeScript adds DECORATOR; future descendants may add
   * type-annotation modes). Spec §8.2.1.
   */
  readonly PARAMS_CONTAINS: readonly Mode[];

  /**
   * The mode that matches a class reference. Used in
   * `interface ... extends Foo`, where TS reaches in via the typed
   * extension surface to compose its own mode tree. Spec §8.2.1 / §8.2.2.
   */
  readonly CLASS_REFERENCE: Mode;
}
