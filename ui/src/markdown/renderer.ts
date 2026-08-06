// ============================================================
// markdown/renderer.ts — Token → HTML renderer
// ============================================================

import { parse } from './parser';
import type { BlockToken, HeadingToken, ListToken, TableToken, BlockquoteToken, HtmlCommentToken, MathBlockToken } from './parser';
import { renderInline } from './inline';
import { renderCodeBlock } from './codeRenderer';
import { slugify, escHtml, renderButton } from './utils';
import { renderInteractiveTable } from './tableRenderer';
import type { TocEntry } from './types';

interface RenderedOutput {
  html: string;
  toc: TocEntry[];
}

/** Sections group tokens under a heading for collapsible UI */
interface Section {
  heading: HeadingToken;
  children: SectionNode[];
}

type TopLevelNode = Section | BlockToken;
type SectionNode = TopLevelNode;
const VIDEO_PARAGRAPH_RE = /(?:\.(?:mp4|m4v|webm|ogv|ogg|mov|mkv|m3u8)(?:[?#][^\s)]*)?)(?:\)|$)/i;
const YOUTUBE_PARAGRAPH_RE = /https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?[^)\s]*\bv=|embed\/|shorts\/|live\/)|youtu\.be\/)[^)\s]+/i;

const IMAGE_ONLY_MARKDOWN_RE = /\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)/g;

function sourceAttributes(token: BlockToken, kind: 'text' | 'math' = 'text'): string {
  const start = token.sourceStart ?? 0;
  const end = token.sourceEnd ?? start;
  return `data-mdn-source-start="${start}" data-mdn-source-end="${end}" data-mdn-bookmark-kind="${kind}"`;
}

function renderImageRowParagraph(token: Extract<BlockToken, { type: 'paragraph' }>, isMdx: boolean): string | null {
  const text = token.text;
  const matches = Array.from(text.matchAll(IMAGE_ONLY_MARKDOWN_RE));
  if (matches.length < 2) return null;

  let cursor = 0;
  for (const match of matches) {
    const matchIndex = match.index ?? 0;
    if (text.slice(cursor, matchIndex).trim() !== '') return null;
    cursor = matchIndex + match[0].length;
  }
  if (text.slice(cursor).trim() !== '') return null;

  const items = matches.map((match) =>
    `<span class="mdn-image-row__item">${renderInline(match[0], isMdx)}</span>`,
  ).join('');
  return `<div class="mdn-image-row" ${sourceAttributes(token)} style="--mdn-image-count:${matches.length}">${items}</div>`;
}

export interface HtmlRendererOptions {
  theme?: string;
  isMdx?: boolean;
  defaultHtmlPreview?: boolean;
  defaultCsvPreview?: boolean;
}

export class HtmlRenderer {
  private readonly toc: TocEntry[] = [];
  private readonly headingIdCounts = new Map<string, number>();
  private readonly theme: string;
  private readonly isMdx: boolean;
  private readonly defaultHtmlPreview: boolean;
  private readonly defaultCsvPreview: boolean;

  constructor(options?: HtmlRendererOptions) {
    this.theme = options?.theme || 'auto';
    this.isMdx = options?.isMdx || false;
    this.defaultHtmlPreview = options?.defaultHtmlPreview !== false;
    this.defaultCsvPreview = options?.defaultCsvPreview !== false;
  }

  render(tokens: BlockToken[]): RenderedOutput {
    const nodes = this.groupSections(tokens);
    const html = nodes.map(n => this.renderNode(n)).join('\n');
    return { html, toc: this.toc };
  }

  // ── Section grouping ───────────────────────────────────────

  /**
   * Group consecutive tokens under H1/H2 headings to form collapsible sections.
   * H2 sections nest under the nearest preceding H1, so an empty H1 does not
   * render as a standalone panel when its first content is a child heading.
   * H3+ become sub-headings rendered inside their parent section.
   */
  private groupSections(tokens: BlockToken[]): TopLevelNode[] {
    const result: TopLevelNode[] = [];
    let currentH1: Section | null = null;
    let currentH2: Section | null = null;

    const appendToCurrentScope = (node: SectionNode): void => {
      if (currentH2) {
        currentH2.children.push(node);
      } else if (currentH1) {
        currentH1.children.push(node);
      } else {
        result.push(node);
      }
    };
    const closeCurrentH2 = (): void => {
      if (!currentH2) return;
      if (currentH1) {
        currentH1.children.push(currentH2);
      } else {
        result.push(currentH2);
      }
      currentH2 = null;
    };

    for (const token of tokens) {
      if (token.type === 'heading' && token.level === 1) {
        closeCurrentH2();
        if (currentH1) {
          result.push(currentH1);
        }
        currentH1 = { heading: token, children: [] };
      } else if (token.type === 'heading' && token.level === 2) {
        closeCurrentH2();
        currentH2 = { heading: token, children: [] };
      } else if (currentH1 || currentH2) {
        appendToCurrentScope(token);
      } else {
        result.push(token);
      }
    }

    closeCurrentH2();
    if (currentH1) {
      result.push(currentH1);
    }

    return result;
  }

  private renderNode(node: TopLevelNode): string {
    if ('heading' in node) return this.renderSection(node);
    return this.renderBlock(node);
  }

  // ── Collapsible section ────────────────────────────────────

  private nextHeadingId(text: string): string {
    const baseId = slugify(text);
    const duplicateIndex = this.headingIdCounts.get(baseId) ?? 0;
    this.headingIdCounts.set(baseId, duplicateIndex + 1);
    return duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex}`;
  }

  private renderSection(section: Section): string {
    const { level, text } = section.heading;
    const id = this.nextHeadingId(text);
    const headingHtml = renderInline(text, this.isMdx);

    this.toc.push({ level, text, id });
    const inner = section.children.map(b => this.renderNode(b)).join('\n');
    const copyBtnHtml = renderButton({
      className: 'mdn-section-copy-btn',
      onClick: 'UI.copySection(this,event)',
      label: 'Copy',
      tooltip: 'Copy section content',
      onKeyDown: 'event.stopPropagation()',
      iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    });

    return `<section class="mdn-section mdn-section--h${level}" id="${id}" data-expanded="true">
  <div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true">
    <${`h${level}`} class="mdn-section-title">
      <span class="mdn-heading-text" ${sourceAttributes(section.heading)}>${headingHtml}<span class="mdn-heading-level" aria-hidden="true">H${level}</span></span>
    </${`h${level}`}>
    ${copyBtnHtml}
    <span class="mdn-section-chevron" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </span>
  </div>
  <div class="mdn-section-body">${inner || ''}</div>
</section>`;
  }

  // ── Block renderers ────────────────────────────────────────

  private renderBlock(token: BlockToken): string {
    switch (token.type) {
      case 'heading':    return this.renderSubHeading(token);
      case 'paragraph':
        if (token.isJsx || (this.isMdx && /^\s*</.test(token.text))) {
          return `<div class="mdn-mdx-block" ${sourceAttributes(token)}>${renderInline(token.text, true)}</div>`;
        }
        if (this.isVideoParagraph(token.text)) {
          return `<div class="mdn-media-paragraph" ${sourceAttributes(token)}>${renderInline(token.text, this.isMdx)}</div>`;
        }
        return renderImageRowParagraph(token, this.isMdx)
          ?? `<p ${sourceAttributes(token)}>${renderInline(token.text, this.isMdx)}</p>`;
      case 'html-comment': return this.renderHtmlComment(token);
      case 'math':       return this.renderMath(token);
      case 'code':       return renderCodeBlock(token, {
        theme: this.theme,
        isMdx: this.isMdx,
        defaultHtmlPreview: this.defaultHtmlPreview,
        defaultCsvPreview: this.defaultCsvPreview,
      });
      case 'blockquote': return this.renderBlockquote(token);
      case 'table':      return this.renderTable(token);
      case 'list':       return this.renderList(token);
      case 'hr':         return `<hr class="mdn-divider" ${sourceAttributes(token)} />`;
    }
  }

  private renderSubHeading(token: HeadingToken): string {
    const id = this.nextHeadingId(token.text);
    const html = renderInline(token.text, this.isMdx);
    this.toc.push({ level: token.level, text: token.text, id });
    return `<h${token.level} class="mdn-subheading" id="${id}" tabindex="-1">
  <span class="mdn-heading-text" ${sourceAttributes(token)}>${html}<span class="mdn-heading-level" aria-hidden="true">H${token.level}</span></span>
</h${token.level}>`;
}

  private isVideoParagraph(text: string): boolean {
    const trimmed = text.trim();
    return /^<(video|figure)\b/i.test(trimmed) ||
      YOUTUBE_PARAGRAPH_RE.test(trimmed) ||
      /^!\[[^\]]*\]\([^)]+\)$/i.test(trimmed) && VIDEO_PARAGRAPH_RE.test(trimmed) ||
      /^\[[^\]]+\]\([^)]+\)$/i.test(trimmed) && VIDEO_PARAGRAPH_RE.test(trimmed) ||
      /^https?:\/\/\S+$/i.test(trimmed) && VIDEO_PARAGRAPH_RE.test(trimmed);
  }

  private renderMath(token: MathBlockToken): string {
    const source = token.content.trim();
    return `<div class="mdn-math mdn-math-block" ${sourceAttributes(token, 'math')} data-mdn-math-source="${encodeURIComponent(source)}" data-math="${encodeURIComponent(source)}"><pre>${escHtml(source)}</pre></div>`;
  }

  private renderHtmlComment(token: HtmlCommentToken): string {
    return `<div class="mdn-html-comment" ${sourceAttributes(token)} role="note"><code>${escHtml(token.content)}</code></div>`;
  }

  private renderBlockquote(token: BlockquoteToken): string {
    // Detect callout from the first line: > [!NOTE], > [!WARNING], etc.
    const firstLine = token.lines[0] ?? '';
    const callout = /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i.exec(firstLine);

    if (callout) {
      const type = callout[1].toLowerCase();
      const ICONS: Record<string, string> = {
        note: '📘', tip: '💡', warning: '⚠️', important: '🔔', caution: '🚨',
      };

      // Combine any inline text after [!TYPE] with remaining lines
      const inlineAfterTag = callout[2].trim();
      const bodyLines = token.lines.slice(1);
      const bodySource = [inlineAfterTag, ...bodyLines].filter(Boolean).join('\n');

      // Parse body as full markdown so task lists, lists, code etc. all work
      let bodyHtml = '';
      if (bodySource) {
        const { tokens: bodyTokens } = parse(bodySource);
        bodyHtml = bodyTokens.map(b => this.renderBlock(b)).join('');
      }

      return `<div class="mdn-callout mdn-callout--${type}" ${sourceAttributes(token)} role="note">
  <div class="mdn-callout-header">
    <span class="mdn-callout-icon" aria-hidden="true">${ICONS[type] ?? '📌'}</span>
    <span class="mdn-callout-label">${callout[1].toUpperCase()}</span>
  </div>
  <div class="mdn-callout-body">${bodyHtml}</div>
</div>`;
    }

    return `<blockquote class="mdn-blockquote" ${sourceAttributes(token)}>${renderInline(token.lines.join('\n'), this.isMdx)}</blockquote>`;
  }

  private renderTable(token: TableToken): string {
    return `<div class="mdn-table-source" ${sourceAttributes(token)}>${renderInteractiveTable({
      headers: token.headers,
      rows: token.rows,
      align: token.align,
    }, this.isMdx)}</div>`;
  }

  private renderList(token: ListToken): string {
    const tag = token.ordered ? 'ol' : 'ul';
    const startAttr = (token.ordered && token.start !== undefined && token.start !== 1) ? ` start="${token.start}"` : '';
    const cls = token.ordered ? 'mdn-list mdn-list--ol' : 'mdn-list';
    const items = token.items.map(item => {
      const nestedContent = item.nestedMarkdown ? `<div class="mdn-list-nested">${this.renderNestedMarkdown(item.nestedMarkdown)}</div>` : '';
      if (item.isTask) {
        const checkedCls = item.checked ? ' is-checked' : '';
        const checkSvg = item.checked
          ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : '';
        return `<li class="mdn-list-item mdn-task${checkedCls}">
  <span class="mdn-checkbox" aria-hidden="true">${checkSvg}</span>
  <span>${renderInline(item.text, this.isMdx)}${nestedContent}</span>
</li>`;
      }
      return `<li class="mdn-list-item">${renderInline(item.text, this.isMdx)}${nestedContent}</li>`;
    }).join('');
    return `<${tag}${startAttr} class="${cls}" ${sourceAttributes(token)}>${items}</${tag}>`;
  }

  private renderNestedMarkdown(markdown: string): string {
    const { tokens } = parse(markdown, this.isMdx);
    return tokens.map(token => this.renderBlock(token)).join('\n');
  }
}
