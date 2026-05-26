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
    const headingHtml = renderInline(text, this.isMdx);
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
      case 'paragraph':
        if (token.isJsx || (this.isMdx && /^\s*</.test(token.text))) {
          return renderInline(token.text, true);
        }
        return `<p>${renderInline(token.text, this.isMdx)}</p>`;
      case 'code':       return this.renderCode(token);
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

  private renderCode(token: CodeBlockToken): string {
    const lang = escHtml(token.lang || 'text');
    const firstWord = token.content.trim().split(/[\s\n\r]/)[0];
    const mermaidKeywords = [
      'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 
      'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart', 
      'xychart-beta', 'mindmap', 'timeline', 'gitGraph', 'c4Diagram', 'sankey-beta', 
      'block', 'packet-beta', 'kanban', 'architecture', 'zenuml', 'requirementDiagram', 'info'
    ];
    const isMermaid = lang.toLowerCase() === 'mermaid' ||
      ((!token.lang || token.lang.toLowerCase() === 'text') && mermaidKeywords.includes(firstWord));
    if (isMermaid) {
      return `<div class="mdn-mermaid-wrap">
  <div class="mermaid">${token.content}</div>
</div>`;
    }

    if (lang.toLowerCase() === 'html') {
      const iframeId = shortId('html');
      const wrappedDoc = `<!DOCTYPE html>
<html lang="en" data-theme="${this.theme}">
<head>
<meta charset="UTF-8" />
<style>
  :root {
    --font-ui: -apple-system, 'Segoe UI', system-ui, sans-serif;
    --font-mono: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
    --accent: #8b7cf8;
    --success: #34d399;
    --danger: #f87171;
  }
  [data-theme="dark"], [data-theme="auto"] {
    --bg: #1a1a1e; --bg-s: #222228; --bg-e: #2a2a32; --bg-h: #31313c; --bg-a: #383845; --bg-code: #17171c;
    --bd: rgba(255,255,255,.10); --bd-s: rgba(255,255,255,.18); --bd-x: rgba(255,255,255,.26);
    --tx: #e2e2e8; --tx2: #9191a4; --txm: #56566a; --txc: #93c5fd;
  }
  [data-theme="light"] {
    --bg: #f7f6f3; --bg-s: #faf9f6; --bg-e: #efede8; --bg-h: #e5e3dd; --bg-a: #d8d5cd; --bg-code: #f0ede8;
    --bd: rgba(0,0,0,.11); --bd-s: rgba(0,0,0,.18); --bd-x: rgba(0,0,0,.28);
    --tx: #1c1c20; --tx2: #484854; --txm: #666672; --txc: #3730a3;
  }
  @media (prefers-color-scheme: light) {
    [data-theme="auto"] {
      --bg: #f7f6f3; --bg-s: #faf9f6; --bg-e: #efede8; --bg-h: #e5e3dd; --bg-a: #d8d5cd; --bg-code: #f0ede8;
      --bd: rgba(0,0,0,.11); --bd-s: rgba(0,0,0,.18); --bd-x: rgba(0,0,0,.28);
      --tx: #1c1c20; --tx2: #484854; --txm: #666672; --txc: #3730a3;
    }
  }
  body {
    margin: 0;
    padding: 16px;
    font-family: var(--font-ui);
    color: var(--tx);
    background: transparent;
  }
</style>
</head>
<body>
${token.content}
<script>
  (function() {
    function sendHeight() {
      window.parent.postMessage({
        type: 'resize-iframe',
        id: '${iframeId}',
        height: document.documentElement.scrollHeight || document.body.scrollHeight
      }, '*');
    }
    window.addEventListener('load', sendHeight);
    window.addEventListener('DOMContentLoaded', sendHeight);
    let lastHeight = 0;
    setInterval(function() {
      let currentHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      if (currentHeight !== lastHeight) {
        lastHeight = currentHeight;
        sendHeight();
      }
    }, 100);
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'set-theme') {
        document.documentElement.setAttribute('data-theme', event.data.theme);
        setTimeout(sendHeight, 50);
      } else if (event.data && event.data.type === 'recalculate-height') {
        sendHeight();
      }
    });
  })();
</script>
</body>
</html>`;

      const escapedDoc = escHtml(wrappedDoc);
      const highlighted = highlight(token.content, token.lang);
      const hasCustomHighlight = highlighted !== escHtml(token.content);
      const isCustom = hasCustomHighlight ? ' is-custom-highlighted' : '';

      const contentWithoutScripts = token.content.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '');
      const contentWithoutStyles = contentWithoutScripts.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '');
      const contentWithoutComments = contentWithoutStyles.replace(/<!--[\s\S]*?-->/g, '');
      const showCodeByDefault = contentWithoutComments.trim() === '';

      const copyBtnHtml = renderButton({
        className: 'mdn-copy-btn',
        onClick: 'UI.copyCode(this)',
        label: 'Copy',
        tooltip: 'Copy code',
        iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      });

      const toggleBtnHtml = renderButton({
        className: 'mdn-toggle-preview-btn',
        onClick: 'UI.toggleHtmlMode(this)',
        label: showCodeByDefault ? 'Show Preview' : 'Show Code',
        tooltip: showCodeByDefault ? 'Show Preview' : 'Show Code',
        iconHtml: showCodeByDefault
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>'
      });

      const lines = token.content.split('\n');
      const totalLines = lines.length;
      let gutterHtml = '';
      if (token.content.trim() !== '') {
        const lineSpans = Array.from({ length: totalLines }, (_, i) => `<span>${i + 1}</span>`).join('');
        gutterHtml = `<div class="mdn-codeblock-gutter">${lineSpans}</div>`;
      }

      const toggleCodeBtnHtml = totalLines > 20
        ? `<button class="mdn-codeblock-toggle-btn" onclick="UI.toggleCodeCollapse(this)">Show More</button>`
        : '';

      return `<div class="mdn-codeblock mdn-html-preview-wrap" data-mode="${showCodeByDefault ? 'code' : 'preview'}"${totalLines > 20 ? ' data-collapsed="true"' : ''}>
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang">${showCodeByDefault ? 'HTML' : 'HTML Preview'}</span>
    <div style="display:flex;gap:4px;align-items:center">
      ${toggleBtnHtml}
      ${copyBtnHtml}
    </div>
  </div>
  <div class="mdn-html-preview-body" style="${showCodeByDefault ? 'display:none' : ''}">
    <iframe id="${iframeId}" class="mdn-html-preview-iframe" sandbox="allow-scripts" srcdoc="${escapedDoc}"></iframe>
  </div>
  <div class="mdn-codeblock-body" style="${showCodeByDefault ? '' : 'display:none'}">
    ${gutterHtml}
    <pre class="mdn-pre"><code class="language-html${isCustom}">${highlighted}</code></pre>
  </div>
  ${toggleCodeBtnHtml}
</div>`;
    }

    const highlighted = highlight(token.content, token.lang);
    const hasCustomHighlight = highlighted !== escHtml(token.content);
    const isCustom = hasCustomHighlight ? ' is-custom-highlighted' : '';
    const copyBtnHtml = renderButton({
      className: 'mdn-copy-btn',
      onClick: 'UI.copyCode(this)',
      label: 'Copy',
      tooltip: 'Copy code',
      iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg>'
    });

    // Compute line numbers if the block has content
    const lines = token.content.split('\n');
    const totalLines = lines.length;
    let gutterHtml = '';
    const showLineNumbers = lang.toLowerCase() !== 'text' && token.content.trim() !== '';
    if (showLineNumbers) {
      const lineSpans = Array.from({ length: totalLines }, (_, i) => `<span>${i + 1}</span>`).join('');
      gutterHtml = `<div class="mdn-codeblock-gutter">${lineSpans}</div>`;
    }

    const toggleCodeBtnHtml = totalLines > 20
      ? `<button class="mdn-codeblock-toggle-btn" onclick="UI.toggleCodeCollapse(this)">Show More</button>`
      : '';

    return `<div class="mdn-codeblock"${totalLines > 20 ? ' data-collapsed="true"' : ''}>
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang">${lang}</span>
    ${copyBtnHtml}
  </div>
  <div class="mdn-codeblock-body">
    ${gutterHtml}
    <pre class="mdn-pre"><code class="language-${lang}${isCustom}">${highlighted}</code></pre>
  </div>
  ${toggleCodeBtnHtml}
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
        ? `<span class="mdn-table-filter-btn" onclick="event.stopPropagation(); Table.showFilterMenu('${id}', ${i}, this)" title="Filter by category" role="button" tabindex="0">
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
    <div class="mdn-table-view-switcher" id="${id}-switcher" style="margin-left:auto; display:flex; gap:4px;"></div>
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
    const cls = token.ordered ? 'mdn-list mdn-list--ol' : 'mdn-list';
    const items = token.items.map(item => {
      if (item.isTask) {
        const checkedCls = item.checked ? ' is-checked' : '';
        const checkSvg = item.checked
          ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : '';
        return `<li class="mdn-list-item mdn-task${checkedCls}">
  <span class="mdn-checkbox" aria-hidden="true">${checkSvg}</span>
  <span>${renderInline(item.text, this.isMdx)}</span>
</li>`;
      }
      return `<li class="mdn-list-item">${renderInline(item.text, this.isMdx)}</li>`;
    }).join('');
    return `<${tag} class="${cls}">${items}</${tag}>`;
  }
}
