// ============================================================
// markdown/renderer.ts — Token → HTML renderer
// ============================================================

import { parse } from './parser';
import type { BlockToken, HeadingToken, ListToken, TableToken, BlockquoteToken, HtmlCommentToken, MathBlockToken } from './parser';
import { renderInline } from './inline';
import { renderCodeBlock } from './codeRenderer';
import { slugify, shortId, escHtml, renderButton } from './utils';
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

export interface HtmlRendererOptions {
  theme?: string;
  isMdx?: boolean;
}

export class HtmlRenderer {
  private readonly toc: TocEntry[] = [];
  private readonly theme: string;
  private readonly isMdx: boolean;

  constructor(options?: HtmlRendererOptions) {
    this.theme = options?.theme || 'auto';
    this.isMdx = options?.isMdx || false;
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

  private renderSection(section: Section): string {
    const { level, text } = section.heading;
    const id = slugify(text);
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
  <div class="mdn-section-header" onclick="UI.toggleSection(this)" role="button" tabindex="0" aria-expanded="true"
       onkeydown="if(event.key==='Enter'||event.key===' ')UI.toggleSection(this)">
    <${`h${level}`} class="mdn-section-title">
      <a class="mdn-anchor" href="#${id}" onclick="event.stopPropagation()" title="Copy link">#</a>${headingHtml}
    </${`h${level}`}>
    <span class="mdn-section-heading-level" aria-hidden="true">H${level}</span>
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
          return renderInline(token.text, true);
        }
        if (this.isVideoParagraph(token.text)) {
          return renderInline(token.text, this.isMdx);
        }
        return `<p>${renderInline(token.text, this.isMdx)}</p>`;
      case 'html-comment': return this.renderHtmlComment(token);
      case 'math':       return this.renderMath(token);
      case 'code':       return renderCodeBlock(token, this.theme);
      case 'blockquote': return this.renderBlockquote(token);
      case 'table':      return this.renderTable(token);
      case 'list':       return this.renderList(token);
      case 'hr':         return '<hr class="mdn-divider" />';
    }
  }

  private renderSubHeading(token: HeadingToken): string {
    const id = slugify(token.text);
    const html = renderInline(token.text, this.isMdx);
    this.toc.push({ level: token.level, text: token.text, id });
    return `<h${token.level} class="mdn-subheading" id="${id}">
  <a class="mdn-anchor" href="#${id}" title="Copy link">#</a>${html}
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
    return `<div class="mdn-math mdn-math-block" data-math="${encodeURIComponent(source)}"><pre>${escHtml(source)}</pre></div>`;
  }

  private renderHtmlComment(token: HtmlCommentToken): string {
    return `<div class="mdn-html-comment" role="note"><code>${escHtml(token.content)}</code></div>`;
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

      return `<div class="mdn-callout mdn-callout--${type}" role="note">
  <div class="mdn-callout-header">
    <span class="mdn-callout-icon" aria-hidden="true">${ICONS[type] ?? '📌'}</span>
    <span class="mdn-callout-label">${callout[1].toUpperCase()}</span>
  </div>
  <div class="mdn-callout-body">${bodyHtml}</div>
</div>`;
    }

    return `<blockquote class="mdn-blockquote">${renderInline(token.lines.join('\n'), this.isMdx)}</blockquote>`;
  }

  private isCategoryColumn(rows: string[][], colIndex: number): boolean {
    const N = rows.length;
    if (N < 3) return false;
    const values = rows.map(r => (r[colIndex] ?? '').trim()).filter(Boolean);
    const unique = new Set(values);
    const U = unique.size;
    if (U <= 1 || U >= N) return false;

    const ratio = U / N;
    const totalLength = values.reduce((sum, v) => sum + v.length, 0);
    const avgLength = totalLength / values.length;

    return (U <= 10 || ratio <= 0.4) && avgLength < 40;
  }

  private renderTable(token: TableToken): string {
    const id = shortId('tbl');

    const thead = token.headers.map((h, i) => {
      const alignAttr = token.align[i] ? ` style="text-align:${token.align[i]}"` : '';
      const isCat = this.isCategoryColumn(token.rows, i);
      const filterBtnHtml = isCat
        ? `<span class="mdn-table-filter-btn" onclick="event.stopPropagation(); Table.showFilterMenu('${id}', ${i}, this)" title="Filter by values" role="button" tabindex="0">
             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
           </span>`
        : '';
      return `<th class="mdn-th${isCat ? ' has-filter' : ''}" data-col="${i}" onclick="Table.sort('${id}',${i})" tabindex="0"${alignAttr}>
  <div class="mdn-th-content">
    <span class="mdn-th-text">${renderInline(h, this.isMdx)}</span>
    <span class="mdn-sort-icon" aria-hidden="true">⇅</span>
    ${filterBtnHtml}
  </div>
</th>`;
    }).join('');

    const tbody = token.rows.map((row, idx) => {
      const rowClass = idx >= 15 ? ' class="is-collapsed-row"' : '';
      return `<tr${rowClass}>${row.map((cell, i) => {
        const alignAttr = token.align[i] ? ` style="text-align:${token.align[i]}"` : '';
        return `<td${alignAttr}>${renderInline(cell, this.isMdx)}</td>`;
      }).join('')}</tr>`;
    }).join('\n');

    const toggleBtnHtml = token.rows.length > 15
      ? `<button class="mdn-table-toggle-btn" onclick="Table.toggleCollapse('${id}')" id="${id}-toggle-btn">Show More</button>`
      : '';

    return `<div class="mdn-table-wrap" id="${id}-wrap">
  <div class="mdn-table-toolbar">
    <label class="mdn-table-search-wrap" aria-label="Search table">
      <svg class="mdn-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="mdn-table-input" type="search" placeholder="Filter rows…" oninput="Table.filter('${id}',this.value)" />
    </label>
    <span class="mdn-row-count" id="${id}-count"></span>
    <div class="mdn-table-toolbar-actions">
      <button class="mdn-table-wrap-toggle" id="${id}-wrap-toggle" onclick="Table.toggleWrap('${id}', this)" aria-pressed="false" title="Wrap table text">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 7h16"/><path d="M4 12h10a4 4 0 0 1 0 8H9"/><path d="m12 17-3 3 3 3"/></svg><span class="mdn-table-wrap-toggle__label">Wrap</span>
      </button>
      <div class="mdn-table-view-switcher" id="${id}-switcher"></div>
    </div>
  </div>
  <div class="mdn-table-scroll" id="${id}-scroll">
    <table class="mdn-table" id="${id}">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>
  <div class="mdn-table-chart-container" id="${id}-chart-container" style="display:none;">
    <canvas id="${id}-chart-canvas"></canvas>
  </div>
  ${toggleBtnHtml}
</div>`;
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
    return `<${tag}${startAttr} class="${cls}">${items}</${tag}>`;
  }

  private renderNestedMarkdown(markdown: string): string {
    const { tokens } = parse(markdown, this.isMdx);
    return tokens.map(token => this.renderBlock(token)).join('\n');
  }
}
