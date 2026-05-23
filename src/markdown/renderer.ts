// ============================================================
// markdown/renderer.ts — Token → HTML renderer
// ============================================================

import { parse } from './parser';
import type { BlockToken, HeadingToken, ListToken, TableToken, CodeBlockToken, BlockquoteToken } from './parser';
import { renderInline } from './inline';
import { highlight } from './highlighter';
import { slugify, shortId, escHtml, renderButton } from '../utils';
import type { TocEntry } from '../types';

interface RenderedOutput {
  html: string;
  toc: TocEntry[];
}

/** Sections group tokens under a heading for collapsible UI */
interface Section {
  heading: HeadingToken;
  children: BlockToken[];
}

type TopLevelNode = Section | BlockToken;

export class HtmlRenderer {
  private readonly toc: TocEntry[] = [];

  render(tokens: BlockToken[]): RenderedOutput {
    const nodes = this.groupSections(tokens);
    const html = nodes.map(n => this.renderNode(n)).join('\n');
    return { html, toc: this.toc };
  }

  // ── Section grouping ───────────────────────────────────────

  /**
   * Group consecutive tokens under H1/H2 headings to form collapsible sections.
   * H3+ become sub-headings rendered inside their parent section.
   */
  private groupSections(tokens: BlockToken[]): TopLevelNode[] {
    const result: TopLevelNode[] = [];
    let current: Section | null = null;

    for (const token of tokens) {
      if (token.type === 'heading' && token.level <= 2) {
        if (current) result.push(current);
        current = { heading: token, children: [] };
      } else if (current) {
        current.children.push(token);
      } else {
        result.push(token);
      }
    }
    if (current) result.push(current);
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
    const headingHtml = renderInline(text);
    const inner = section.children.map(b => this.renderBlock(b)).join('\n');

    this.toc.push({ level, text, id });

    return `<section class="mdn-section mdn-section--h${level}" id="${id}" data-expanded="true">
  <div class="mdn-section-header" onclick="UI.toggleSection(this)" role="button" tabindex="0" aria-expanded="true"
       onkeydown="if(event.key==='Enter'||event.key===' ')UI.toggleSection(this)">
    <${`h${level}`} class="mdn-section-title">
      <a class="mdn-anchor" href="#${id}" onclick="event.stopPropagation()" title="Copy link">#</a>${headingHtml}
    </${`h${level}`}>
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
      case 'paragraph':  return `<p>${renderInline(token.text)}</p>`;
      case 'code':       return this.renderCode(token);
      case 'blockquote': return this.renderBlockquote(token);
      case 'table':      return this.renderTable(token);
      case 'list':       return this.renderList(token);
      case 'hr':         return '<hr class="mdn-divider" />';
    }
  }

  private renderSubHeading(token: HeadingToken): string {
    const id = slugify(token.text);
    const html = renderInline(token.text);
    this.toc.push({ level: token.level, text: token.text, id });
    return `<h${token.level} class="mdn-subheading" id="${id}">
  <a class="mdn-anchor" href="#${id}" title="Copy link">#</a>${html}
</h${token.level}>`;
  }

  private renderCode(token: CodeBlockToken): string {
    const lang = escHtml(token.lang || 'text');
    if (lang.toLowerCase() === 'mermaid') {
      return `<div class="mdn-mermaid-wrap">
  <div class="mermaid">${escHtml(token.content)}</div>
</div>`;
    }

    const highlighted = highlight(token.content, token.lang);
    const isCustom = lang.toLowerCase() === 'diff' ? ' is-custom-highlighted' : '';
    const copyBtnHtml = renderButton({
      className: 'mdn-copy-btn',
      onClick: 'UI.copyCode(this)',
      label: 'Copy',
      tooltip: 'Copy code',
      iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    });

    return `<div class="mdn-codeblock">
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang">${lang}</span>
    ${copyBtnHtml}
  </div>
  <pre class="mdn-pre"><code class="language-${lang}${isCustom}">${highlighted}</code></pre>
</div>`;
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

    return `<blockquote class="mdn-blockquote">${renderInline(token.lines.join('\n'))}</blockquote>`;
  }

  private renderTable(token: TableToken): string {
    const id = shortId('tbl');

    const thead = token.headers.map((h, i) => {
      const alignAttr = token.align[i] ? ` style="text-align:${token.align[i]}"` : '';
      return `<th class="mdn-th" data-col="${i}" onclick="Table.sort('${id}',${i})" tabindex="0"${alignAttr}>
  ${renderInline(h)}<span class="mdn-sort-icon" aria-hidden="true">⇅</span>
</th>`;
    }).join('');

    const tbody = token.rows.map(row =>
      `<tr>${row.map((cell, i) => {
        const alignAttr = token.align[i] ? ` style="text-align:${token.align[i]}"` : '';
        return `<td${alignAttr}>${renderInline(cell)}</td>`;
      }).join('')}</tr>`
    ).join('\n');

    const toggleBtnHtml = token.rows.length > 15
      ? `<button class="mdn-table-toggle-btn" onclick="Table.toggleCollapse('${id}')" id="${id}-toggle-btn">Show More</button>`
      : '';

    return `<div class="mdn-table-wrap">
  <div class="mdn-table-toolbar">
    <label class="mdn-table-search-wrap" aria-label="Search table">
      <svg class="mdn-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="mdn-table-input" type="search" placeholder="Filter rows…" oninput="Table.filter('${id}',this.value)" />
    </label>
    <span class="mdn-row-count" id="${id}-count"></span>
  </div>
  <div class="mdn-table-scroll">
    <table class="mdn-table" id="${id}">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>
  ${toggleBtnHtml}
</div>`;
  }

  private renderList(token: ListToken): string {
    const tag = token.ordered ? 'ol' : 'ul';
    const cls = token.ordered ? 'mdn-list mdn-list--ol' : 'mdn-list';
    const items = token.items.map(item => {
      if (item.isTask) {
        const checkedCls = item.checked ? ' is-checked' : '';
        const checkSvg = item.checked
          ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : '';
        return `<li class="mdn-list-item mdn-task${checkedCls}">
  <span class="mdn-checkbox" aria-hidden="true">${checkSvg}</span>
  <span>${renderInline(item.text)}</span>
</li>`;
      }
      return `<li class="mdn-list-item">${renderInline(item.text)}</li>`;
    }).join('');
    return `<${tag} class="${cls}">${items}</${tag}>`;
  }
}
