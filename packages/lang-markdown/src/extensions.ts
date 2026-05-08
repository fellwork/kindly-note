// MarkdownExtensionPoints — the typed extension surface published by
// @kindly-note/lang-markdown. spec §1.5 row `@kindly-note/lang-markdown`:
// "Exposes typed `MarkdownExtensionPoints` for downstream extenders
// (lang-markdown-gfm, MDX) via `defineLanguage({ extensible: ... })`."
//
// spec §13.2 dialect strategy: the GFM extension (`@kindly-note/lang-markdown-gfm`)
// is a SEPARATE later package authored as `extendLanguage(commonMark, ...)`.
// Custom dialects (Notion-style wikilinks, Obsidian, MDX) are authored as
// further `extendLanguage()` packages (or as plugins, see spec §2 for the
// user-extensibility surface).
//
// spec §0 architectural shift #5 + spec §8.2 THE KEYSTONE: descendants extend
// through the typed `extend()` API, not through array-mutation of an `exports`
// field. The shape declared here is what cohort 7+ `lang-markdown-gfm` will
// consume via `extendLanguage(markdown, { extendPoints: { INLINE_CONTAINS: ..., ... } })`.
//
// v0 surface: this is intentionally a SMALL, shape-first declaration. The
// extension points are chosen to anticipate the most-likely GFM additions
// (autolinks, strikethrough, task-list markers, table delimiters) without
// over-fitting to any one dialect. Future cohorts MAY add new optional fields;
// existing ones MUST remain typed-stable across the v0/v1 boundary.

import type { Mode } from '@kindly-note/core';

/**
 * The typed extension surface published by `@kindly-note/lang-markdown`. spec
 * §1.5 mandates this be a `type` named export (not a `const`) so downstream
 * consumers (especially `@kindly-note/lang-markdown-gfm`) can satisfy the
 * parent's `extensible: T` constraint at the call site (spec §8.2 keystone).
 *
 * Rationale for each extension point — directly mapped to GFM/MDX hot spots
 * we anticipate downstream wanting to extend:
 *
 *   - `INLINE_CONTAINS`: the contains-array used INSIDE inline contexts
 *     (paragraph text, list-item bodies, header text). GFM adds strikethrough
 *     (`~~tilde~~`) and autolinks (bare URLs) here. lang-markdown-gfm will
 *     compose: `extendPoints.INLINE_CONTAINS: (current) => [...current, STRIKETHROUGH, AUTOLINK]`.
 *
 *   - `BLOCK_CONTAINS`: the contains-array used at the top-level (block)
 *     context. GFM adds tables and task-list-item alternatives here.
 *
 *   - `LINK_MODE`: the mode that matches an inline link. Reserved for future
 *     consumers that want to swap in a richer link-handling Mode (e.g.
 *     wikilink-aware renderers); GFM does NOT need this in v1, but exposing
 *     the slot keeps the surface stable for MDX/Obsidian/Notion downstream.
 */
export interface MarkdownExtensionPoints {
  /**
   * The contains-array used inside inline contexts (paragraph bodies, list
   * items, header text, blockquote bodies). Descendants append to it for new
   * inline tokens. spec §13.2: GFM strikethrough + autolinks land here.
   */
  readonly INLINE_CONTAINS: readonly Mode[];

  /**
   * The contains-array used at the top-level (block) context. Descendants
   * append here for new block-level tokens (tables, task lists, etc.).
   * spec §13.2.
   */
  readonly BLOCK_CONTAINS: readonly Mode[];

  /**
   * The Mode that matches an inline link `[text](url)`. Reserved for future
   * dialects (wikilinks, MDX component references) that want to swap richer
   * link semantics. GFM does NOT need to replace this in v1; exposing it
   * keeps the surface stable for downstream cohorts. spec §13.2 / §13.3.
   */
  readonly LINK_MODE: Mode;
}
