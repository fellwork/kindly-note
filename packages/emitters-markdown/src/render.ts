// The block-structuring + inline-rendering pass for
// @kindly-note/emitters-markdown.
//
// WHY THIS SHAPE — `@kindly-note/lang-markdown` is a *highlight-style* tokeniser
// (spec §1.5): it emits a flat, line-oriented stream of scopes
// (`meta`/`section`/`strong`/`emphasis`/`code`/`quote`/`bullet`/`link`/`string`)
// over the raw source, NOT a nested markdown AST. The fence delimiters, the
// blank-line paragraph boundaries, and the per-line block structure all live in
// PLAIN TEXT around those scopes. This renderer therefore reconstructs the
// semantic block + inline structure from the scope stream, applying the
// security policy (spec §13.1) token-by-token while it assembles the string.
// There is no "untrusted HTML" intermediate stage: the renderer only ever emits
// tags it decided to emit for a recognised token.

import type { TokenNode, TokenScope, TokenStream } from '@kindly-note/core';
import { htmlEscape, normalizeBidi } from './escape.js';
import type { UrlPolicy } from './url-policy.js';

/** Render a sub-language code-fence stream to HTML. Injected by the emitter. */
export type CodeFenceRenderer = (stream: TokenStream, language: string) => string;

/** Resolved options the renderer needs. */
export interface RenderContext {
  readonly urlPolicy: UrlPolicy;
  readonly preserveBidiControls: boolean;
  readonly renderCodeFence: CodeFenceRenderer;
}

// ---------------------------------------------------------------------------
// Text helpers — every user-content string passes through here.
// ---------------------------------------------------------------------------

/** Normalise bidi (unless preserved) then HTML-escape. spec §13.1. */
function safeText(text: string, ctx: RenderContext): string {
  const normalised = ctx.preserveBidiControls ? text : normalizeBidi(text);
  return htmlEscape(normalised);
}

/** Escape a value for use inside a double-quoted attribute. spec §13.1. */
function safeAttr(value: string, ctx: RenderContext): string {
  const normalised = ctx.preserveBidiControls ? value : normalizeBidi(value);
  return htmlEscape(normalised);
}

// ---------------------------------------------------------------------------
// Flat-stream model.
//
// We first lower the scope tree into a flat list of "atoms" with explicit line
// breaks, so the block grouper can reason line-by-line. An atom is either a
// recognised inline element, a structural marker, a sub-language code fence, a
// hard line break, or a literal text run.
// ---------------------------------------------------------------------------

type Atom =
  | { kind: 'text'; text: string }
  | { kind: 'newline' }
  | { kind: 'strong'; text: string }
  | { kind: 'emphasis'; text: string }
  | { kind: 'code'; text: string }
  // A highlighted sub-language fence body (already rendered to HTML).
  | { kind: 'codeFence'; html: string }
  // A fully-resolved fenced code BLOCK, ready to wrap in <pre><code>.
  | { kind: 'codeBlock'; html: string }
  | { kind: 'headingHashes'; level: number }
  | { kind: 'section'; text: string }
  | { kind: 'hr' }
  | { kind: 'bullet'; ordered: boolean }
  | { kind: 'quoteLine'; inline: readonly Atom[] }
  // The link sequence arrives as separate scopes; we capture each piece.
  | { kind: 'linkBracketOpen' } // the `[`
  | { kind: 'linkText'; text: string } // scope: link
  | { kind: 'linkBracketMid' } // the `](`
  | { kind: 'linkUrl'; url: string } // scope: string
  | { kind: 'linkBracketClose' }; // the `)`

/** Collect the concatenated plain text of a scope subtree. */
function collectText(node: TokenNode): string {
  if (node.type === 'text') return node.text;
  if (node.type === 'sub-language') return '';
  let out = '';
  for (const child of (node as TokenScope).children) out += collectText(child);
  return out;
}

/** Strip the surrounding `**`/`__`/`*`/`_` delimiters lang-markdown keeps in
 *  the scoped text for strong/emphasis (it scopes `**bold**`, not `bold`). */
function stripEmphasisDelimiters(text: string): string {
  // Longest delimiters first.
  for (const d of ['***', '___', '**', '__', '*', '_']) {
    if (text.length >= d.length * 2 && text.startsWith(d) && text.endsWith(d)) {
      return text.slice(d.length, text.length - d.length);
    }
  }
  return text;
}

const HR_RE = /^[ \t]{0,3}(?:-(?:[ \t]*-){2,}|\*(?:[ \t]*\*){2,}|_(?:[ \t]*_){2,})[ \t]*$/;

function lowerNodeToAtoms(node: TokenNode, ctx: RenderContext, out: Atom[]): void {
  if (node.type === 'text') {
    pushTextWithNewlines(node.text, out);
    return;
  }
  if (node.type === 'sub-language') {
    // A bare sub-language node (inside a `code` scope) — handled by the parent
    // `code` scope branch; if it ever appears standalone, render its fence.
    out.push({ kind: 'codeFence', html: ctx.renderCodeFence(node.stream, node.language) });
    return;
  }
  const scope = (node as TokenScope).scope;
  const children = (node as TokenScope).children;
  switch (scope) {
    case 'meta': {
      const text = collectText(node);
      if (/^#{1,6}$/.test(text)) {
        out.push({ kind: 'headingHashes', level: text.length });
      } else if (HR_RE.test(text)) {
        out.push({ kind: 'hr' });
      } else if (text === '[') {
        out.push({ kind: 'linkBracketOpen' });
      } else if (text === '](') {
        out.push({ kind: 'linkBracketMid' });
      } else if (text === ')') {
        out.push({ kind: 'linkBracketClose' });
      } else {
        // Unknown meta — treat as literal text (escaped downstream).
        pushTextWithNewlines(text, out);
      }
      return;
    }
    case 'section':
      out.push({ kind: 'section', text: collectText(node) });
      return;
    case 'strong':
      out.push({ kind: 'strong', text: stripEmphasisDelimiters(collectText(node)) });
      return;
    case 'emphasis':
      out.push({ kind: 'emphasis', text: stripEmphasisDelimiters(collectText(node)) });
      return;
    case 'code': {
      // Either a sub-language fence or a plain inline/fence code span.
      const sub = children.find((c) => c.type === 'sub-language');
      if (sub !== undefined && sub.type === 'sub-language') {
        out.push({ kind: 'codeFence', html: ctx.renderCodeFence(sub.stream, sub.language) });
      } else {
        out.push({ kind: 'code', text: collectText(node) });
      }
      return;
    }
    case 'bullet': {
      const text = collectText(node);
      out.push({ kind: 'bullet', ordered: /\d/.test(text) });
      return;
    }
    case 'string':
      out.push({ kind: 'linkUrl', url: collectText(node) });
      return;
    case 'link':
      out.push({ kind: 'linkText', text: collectText(node) });
      return;
    case 'quote': {
      // The quote scope holds `> ` + inline content. Lower its children, then
      // strip the leading `>` marker text.
      const inner: Atom[] = [];
      for (const child of children) lowerNodeToAtoms(child, ctx, inner);
      out.push({ kind: 'quoteLine', inline: stripQuoteMarker(inner) });
      return;
    }
    default: {
      // Unknown scope (e.g. a sub-language scope leaking through) — recurse so
      // its text still renders, escaped.
      for (const child of children) lowerNodeToAtoms(child, ctx, out);
      return;
    }
  }
}

const FENCE_OPEN_RE = /^[ \t]{0,3}(?:```|~~~)[^\n]*$/;
const FENCE_CLOSE_RE = /^[ \t]{0,3}(?:```|~~~)[ \t]*$/;

/**
 * Collapse the flat fence sequence the tokeniser produces — `text(fence-open)`,
 * `newline`, `codeFence|code`, `newline`, `text(fence-close)` — into a single
 * `codeBlock` atom, and strip the backtick delimiters that surround an INLINE
 * `code` span. spec §13.1: fence content is always escaped (it arrives as text
 * for generic fences, or pre-rendered safe HTML for a sub-language fence).
 */
function normalizeAtoms(input: readonly Atom[]): Atom[] {
  // Work on a mutable copy so the inline-code pass can trim the lookahead text
  // atom without re-allocating the whole array per hit.
  const atoms: Atom[] = [...input];
  const out: Atom[] = [];
  let i = 0;
  while (i < atoms.length) {
    const a = atoms[i];
    if (a === undefined) {
      i++;
      continue;
    }

    // Fence block: <text:open> <newline> <codeFence|code> <newline> <text:close>
    if (a.kind === 'text' && FENCE_OPEN_RE.test(a.text)) {
      const nl1 = atoms[i + 1];
      const body = atoms[i + 2];
      const nl2 = atoms[i + 3];
      const close = atoms[i + 4];
      if (
        nl1?.kind === 'newline' &&
        (body?.kind === 'codeFence' || body?.kind === 'code') &&
        nl2?.kind === 'newline' &&
        close?.kind === 'text' &&
        FENCE_CLOSE_RE.test(close.text)
      ) {
        const html = body.kind === 'codeFence' ? body.html : htmlEscape(body.text);
        out.push({ kind: 'codeBlock', html });
        i += 5;
        continue;
      }
    }

    // Inline code: strip a trailing backtick from the previous text atom and a
    // leading backtick from the next text atom (lang-markdown excludes the
    // delimiters from the scope but leaves them in the surrounding text).
    if (a.kind === 'code') {
      const prev = out[out.length - 1];
      if (prev !== undefined && prev.kind === 'text' && prev.text.endsWith('`')) {
        out[out.length - 1] = { kind: 'text', text: prev.text.slice(0, -1) };
      }
      out.push(a);
      const next = atoms[i + 1];
      if (next !== undefined && next.kind === 'text' && next.text.startsWith('`')) {
        atoms[i + 1] = { kind: 'text', text: next.text.slice(1) };
      }
      i++;
      continue;
    }

    out.push(a);
    i++;
  }
  return out;
}

/** Split a literal text run on `\n` into text atoms + newline atoms. */
function pushTextWithNewlines(text: string, out: Atom[]): void {
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (part !== '') out.push({ kind: 'text', text: part });
    if (i < parts.length - 1) out.push({ kind: 'newline' });
  }
}

/** Remove the leading `>`/`> ` marker that lang-markdown keeps in quote text. */
function stripQuoteMarker(atoms: readonly Atom[]): readonly Atom[] {
  const first = atoms[0];
  if (first !== undefined && first.kind === 'text') {
    const stripped = first.text.replace(/^[ \t]*>[ \t]?/, '');
    const rest = atoms.slice(1);
    return stripped === '' ? rest : [{ kind: 'text', text: stripped }, ...rest];
  }
  return atoms;
}

// ---------------------------------------------------------------------------
// Inline rendering — turns a run of inline atoms into inline HTML, including
// the multi-atom link reconstruction with the URL security policy.
// ---------------------------------------------------------------------------

/** Safe literal-text rendering for structural atoms that appear mid-line. */
function renderStructuralFallback(a: Atom, ctx: RenderContext): string {
  switch (a.kind) {
    case 'headingHashes':
      return safeText('#'.repeat(a.level), ctx);
    case 'section':
      return safeText(a.text, ctx);
    case 'bullet':
      return '';
    case 'hr':
      return '';
    case 'quoteLine':
      return renderInlineAtoms(a.inline, ctx);
    default:
      return '';
  }
}

function renderInlineAtoms(atoms: readonly Atom[], ctx: RenderContext): string {
  let out = '';
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a === undefined) continue;
    switch (a.kind) {
      case 'text':
        out += safeText(a.text, ctx);
        break;
      case 'newline':
        out += '\n';
        break;
      case 'strong':
        out += `<strong>${safeText(a.text, ctx)}</strong>`;
        break;
      case 'emphasis':
        out += `<em>${safeText(a.text, ctx)}</em>`;
        break;
      case 'code':
        out += `<code>${safeText(a.text, ctx)}</code>`;
        break;
      case 'codeFence':
        // A sub-language fence body that did not get collapsed into a block
        // (e.g. fence delimiters were missing). Wrap defensively in <code>.
        out += `<code>${a.html}</code>`;
        break;
      case 'codeBlock':
        // A resolved block that ended up inline (defensive) — emit as a block.
        out += `<pre><code>${a.html}</code></pre>`;
        break;
      case 'headingHashes':
      case 'section':
      case 'hr':
      case 'bullet':
      case 'quoteLine':
        // Structural atoms can appear mid-line when a block was not recognised
        // as such (e.g. inline `#` in prose). Render their text form safely.
        out += renderStructuralFallback(a, ctx);
        break;
      case 'linkBracketOpen': {
        // Attempt to consume the link sequence: [ , linkText, ](, linkUrl, )
        const consumed = tryRenderLink(atoms, i, ctx);
        if (consumed !== undefined) {
          out += consumed.html;
          i = consumed.nextIndex - 1;
        } else {
          out += safeText('[', ctx);
        }
        break;
      }
      // Stray link pieces (no enclosing bracket-open) render as literal text.
      case 'linkText':
        out += safeText(a.text, ctx);
        break;
      case 'linkBracketMid':
        out += safeText('](', ctx);
        break;
      case 'linkUrl':
        out += safeText(a.url, ctx);
        break;
      case 'linkBracketClose':
        out += safeText(')', ctx);
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Reconstruct an `<a href>` from the flat link-scope sequence the tokeniser
 * produced: `[` (meta) → linkText (link) → `](` (meta) → url (string) → `)`
 * (meta). The URL passes through the security policy (spec §13.1): a blocked
 * scheme yields an anchor with NO href (text preserved), never a dangerous one.
 */
function tryRenderLink(
  atoms: readonly Atom[],
  start: number,
  ctx: RenderContext,
): { html: string; nextIndex: number } | undefined {
  // start points at linkBracketOpen.
  const text = atoms[start + 1];
  const mid = atoms[start + 2];
  const url = atoms[start + 3];
  const close = atoms[start + 4];
  if (
    text?.kind !== 'linkText' ||
    mid?.kind !== 'linkBracketMid' ||
    url?.kind !== 'linkUrl' ||
    close?.kind !== 'linkBracketClose'
  ) {
    return undefined;
  }
  const innerText = safeText(text.text, ctx);
  const decided = ctx.urlPolicy(url.url);
  if (decided === null) {
    // Blocked scheme — preserve the link text, drop the href entirely.
    return { html: `<a>${innerText}</a>`, nextIndex: start + 5 };
  }
  return {
    html: `<a href="${safeAttr(decided, ctx)}">${innerText}</a>`,
    nextIndex: start + 5,
  };
}

// ---------------------------------------------------------------------------
// Block grouping — split the flat atom stream into lines, then group lines into
// blocks (heading / hr / list / blockquote / fenced-code / paragraph).
// ---------------------------------------------------------------------------

type Line = readonly Atom[];

function splitLines(atoms: readonly Atom[]): Line[] {
  const lines: Atom[][] = [];
  let current: Atom[] = [];
  for (const a of atoms) {
    if (a.kind === 'newline') {
      lines.push(current);
      current = [];
    } else {
      current.push(a);
    }
  }
  lines.push(current);
  return lines;
}

/** Is this line "blank" (only whitespace text, no structural/inline atoms)? */
function isBlankLine(line: Line): boolean {
  return line.every((a) => a.kind === 'text' && a.text.trim() === '');
}

function lineLeadKind(line: Line): Atom['kind'] | 'blank' | 'empty' {
  if (line.length === 0) return 'empty';
  if (isBlankLine(line)) return 'blank';
  // Skip leading whitespace-only text atoms to find the structural lead.
  for (const a of line) {
    if (a.kind === 'text' && a.text.trim() === '') continue;
    return a.kind;
  }
  return 'blank';
}

export function renderBlocks(stream: TokenStream, ctx: RenderContext): string {
  const raw: Atom[] = [];
  for (const child of stream.children) lowerNodeToAtoms(child, ctx, raw);
  const atoms = normalizeAtoms(raw);
  const lines = splitLines(atoms);

  const out: string[] = [];
  let i = 0;
  let paragraph: Line[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const inner = paragraph
      .map((line) => renderInlineAtoms(stripLeadingWhitespace(line), ctx))
      .join('\n');
    out.push(`<p>${inner}</p>`);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? [];
    const lead = lineLeadKind(line);

    if (lead === 'blank' || lead === 'empty') {
      flushParagraph();
      i++;
      continue;
    }
    if (lead === 'headingHashes') {
      flushParagraph();
      out.push(renderHeading(line, ctx));
      i++;
      continue;
    }
    if (lead === 'hr') {
      flushParagraph();
      out.push('<hr>');
      i++;
      continue;
    }
    if (lead === 'codeBlock') {
      flushParagraph();
      out.push(renderCodeBlockLine(line));
      i++;
      continue;
    }
    if (lead === 'bullet') {
      flushParagraph();
      const consumed = renderList(lines, i, ctx);
      out.push(consumed.html);
      i = consumed.nextIndex;
      continue;
    }
    if (lead === 'quoteLine') {
      flushParagraph();
      const consumed = renderBlockquote(lines, i, ctx);
      out.push(consumed.html);
      i = consumed.nextIndex;
      continue;
    }
    // Ordinary paragraph line.
    paragraph.push(line);
    i++;
  }
  flushParagraph();

  return out.join('\n');
}

/** Drop leading whitespace-only text atoms from a line. */
function stripLeadingWhitespace(line: Line): Atom[] {
  const copy = [...line];
  while (copy.length > 0) {
    const first = copy[0];
    if (first !== undefined && first.kind === 'text' && first.text.trim() === '') copy.shift();
    else break;
  }
  return copy;
}

function renderHeading(line: Line, ctx: RenderContext): string {
  const cleaned = stripLeadingWhitespace(line);
  const head = cleaned[0];
  const level = head !== undefined && head.kind === 'headingHashes' ? head.level : 1;
  // The heading body is the `section` atom(s) plus any inline atoms after it.
  const bodyAtoms: Atom[] = [];
  for (let k = 1; k < cleaned.length; k++) {
    const a = cleaned[k];
    if (a === undefined) continue;
    if (a.kind === 'section') {
      // The section text may have a leading space the tokeniser kept.
      bodyAtoms.push({ kind: 'text', text: a.text.replace(/^[ \t]+/, '') });
    } else {
      bodyAtoms.push(a);
    }
  }
  const inner = renderInlineAtoms(bodyAtoms, ctx).trimStart();
  const lvl = Math.min(Math.max(level, 1), 6);
  return `<h${lvl}>${inner}</h${lvl}>`;
}

function renderCodeBlockLine(line: Line): string {
  // The line holds a single resolved codeBlock atom (fence delimiters were
  // collapsed during normalizeAtoms). spec §13.1: the html is either escaped
  // plain text (generic fence) or pre-rendered safe sub-language markup.
  for (const a of line) {
    if (a.kind === 'codeBlock') return `<pre><code>${a.html}</code></pre>`;
  }
  return '';
}

function renderList(
  lines: readonly Line[],
  start: number,
  ctx: RenderContext,
): { html: string; nextIndex: number } {
  // Determine ordered-ness from the first bullet.
  const firstLead = stripLeadingWhitespace(lines[start] ?? []);
  const firstBullet = firstLead.find((a) => a.kind === 'bullet');
  const ordered = firstBullet !== undefined && firstBullet.kind === 'bullet' && firstBullet.ordered;
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? [];
    const lead = lineLeadKind(line);
    if (lead === 'blank' || lead === 'empty') {
      // A single blank line ends a tight list in this v0 renderer.
      i++;
      break;
    }
    if (lead !== 'bullet') break;
    const cleaned = stripLeadingWhitespace(line);
    // Drop the leading bullet atom; the rest is the item's inline content.
    const itemAtoms: Atom[] = [];
    let seenBullet = false;
    for (const a of cleaned) {
      if (!seenBullet && a.kind === 'bullet') {
        seenBullet = true;
        continue;
      }
      itemAtoms.push(a);
    }
    const inner = renderInlineAtoms(itemAtoms, ctx).replace(/^[ \t]+/, '');
    items.push(`<li>${inner}</li>`);
    i++;
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, nextIndex: i };
}

function renderBlockquote(
  lines: readonly Line[],
  start: number,
  ctx: RenderContext,
): { html: string; nextIndex: number } {
  const inners: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? [];
    const lead = lineLeadKind(line);
    if (lead !== 'quoteLine') break;
    const cleaned = stripLeadingWhitespace(line);
    for (const a of cleaned) {
      if (a.kind === 'quoteLine') {
        inners.push(renderInlineAtoms(a.inline, ctx));
      }
    }
    i++;
  }
  return { html: `<blockquote><p>${inners.join('\n')}</p></blockquote>`, nextIndex: i };
}
