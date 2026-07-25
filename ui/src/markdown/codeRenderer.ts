import type { CodeBlockToken } from './parser';
import { highlight } from './highlighter';
import { escHtml, renderButton, shortId } from './utils';
import { buildHtmlPreviewDocument, hasRenderableHtmlContent } from './htmlPreviewDocument';
export function renderCodeBlock(token: CodeBlockToken, theme: string): string {
    const lang = escHtml(token.lang || 'text');
    const firstWord = token.content.trim().split(/[\s\n\r]/)[0];
    const mermaidKeywords = [
      'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 
      'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart', 
      'xychart-beta', 'mindmap', 'timeline', 'gitGraph', 'sankey-beta', 
      'block', 'block-beta', 'packet', 'packet-beta', 'kanban', 'architecture', 'architecture-beta', 
      'zenuml', 'requirementDiagram', 'info',
      'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'
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
      const wrappedDoc = buildHtmlPreviewDocument(token.content, {
        theme,
        iframeId,
        target: 'inline',
      });

      const escapedDoc = escHtml(wrappedDoc);
      const highlighted = highlight(token.content, token.lang);
      const hasCustomHighlight = highlighted !== escHtml(token.content);
      const isCustom = hasCustomHighlight ? ' is-custom-highlighted' : '';

      const showCodeByDefault = !hasRenderableHtmlContent(token.content);

      const copyBtnHtml = renderButton({
        className: 'mdn-copy-btn',
        onClick: 'UI.copyCode(this)',
        label: 'Copy code',
        tooltip: 'Copy code',
        title: 'Copy code',
        ariaLabel: 'Copy code',
        dataI18nKey: 'copyCode',
        iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      });

      const openBrowserBtnHtml = renderButton({
        className: 'mdn-open-browser-btn',
        onClick: 'UI.openHtmlPreview(this)',
        label: 'Open in browser',
        tooltip: 'Open in browser',
        title: 'Open in browser',
        ariaLabel: 'Open in browser',
        dataI18nKey: 'openInBrowser',
        iconHtml: '<svg width="13" height="13" viewBox="0 0 122.88 115.71" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M116.56,3.69l-3.84,53.76l-17.69-15c-19.5,8.72-29.96,23.99-30.51,43.77c-17.95-26.98-7.46-50.4,12.46-65.97 L64.96,3L116.56,3.69L116.56,3.69z M28.3,0h14.56v19.67H32.67c-4.17,0-7.96,1.71-10.72,4.47c-2.75,2.75-4.46,6.55-4.46,10.72 l-0.03,46c0.03,4.16,1.75,7.95,4.5,10.71c2.76,2.76,6.56,4.48,10.71,4.48h58.02c4.15,0,7.95-1.72,10.71-4.48 c2.76-2.76,4.48-6.55,4.48-10.71v-6.96h17.01v11.33c0,7.77-3.2,17.04-8.32,22.16c-5.12,5.12-12.21,8.32-19.98,8.32H28.3 c-7.77,0-14.86-3.2-19.98-8.32C3.19,102.26,0,95.18,0,87.41l0.03-59.1C0,20.52,3.19,13.43,8.31,8.31C13.43,3.19,20.51,0,28.3,0 L28.3,0z"/></svg>'
      });

      const openModalBtnHtml = renderButton({
        className: 'mdn-open-modal-btn',
        onClick: 'UI.openHtmlPreviewModal(this)',
        label: 'Open as modal',
        tooltip: 'Open as modal',
        title: 'Open as modal',
        ariaLabel: 'Open as modal',
        dataI18nKey: 'openAsModal',
        iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M15 12h3v3M18 12l-5 5"/></svg>'
      });

      const toggleBtnHtml = renderButton({
        className: 'mdn-toggle-preview-btn',
        onClick: 'UI.toggleHtmlMode(this)',
        label: showCodeByDefault ? 'Show Preview' : 'Show Code',
        tooltip: showCodeByDefault ? 'Show Preview' : 'Show Code',
        title: showCodeByDefault ? 'Show Preview' : 'Show Code',
        ariaLabel: showCodeByDefault ? 'Show Preview' : 'Show Code',
        dataI18nKey: showCodeByDefault ? 'showPreview' : 'showCode',
        iconHtml: showCodeByDefault
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>'
      });

      const lines = token.content.split('\n');
      const totalLines = lines.length;
      let gutterHtml = '';
      if (token.content.trim() !== '') {
        const lineSpans = Array.from({ length: totalLines }, (_, i) => `<span data-line="${i + 1}">${i + 1}</span>`).join('');
        gutterHtml = `<div class="mdn-codeblock-gutter">${lineSpans}</div>`;
      }

      const toggleCodeBtnHtml = totalLines > 20
        ? `<button class="mdn-codeblock-toggle-btn" onclick="UI.toggleCodeCollapse(this)">Show More</button>`
        : '';

      return `<div class="mdn-codeblock mdn-html-preview-wrap" data-preview-theme="${escHtml(theme)}" data-mode="${showCodeByDefault ? 'code' : 'preview'}"${totalLines > 20 ? ' data-collapsed="true"' : ''}>
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang">${showCodeByDefault ? 'HTML' : 'HTML Preview'}</span>
    <div style="display:flex;gap:4px;align-items:center">
      ${openBrowserBtnHtml}
      ${openModalBtnHtml}
      ${toggleBtnHtml}
      ${copyBtnHtml}
    </div>
  </div>
  <div class="mdn-html-preview-body" style="${showCodeByDefault ? 'display:none' : ''}">
    <iframe id="${iframeId}" class="mdn-html-preview-iframe" sandbox="allow-scripts" srcdoc="${escapedDoc}"></iframe>
    <template class="mdn-html-preview-source">${escHtml(token.content)}</template>
  </div>
  <div class="mdn-codeblock-body" style="${showCodeByDefault ? '' : 'display:none'}">
    ${gutterHtml}
    <pre class="mdn-pre" tabindex="0"><code class="language-html${isCustom}">${highlighted}</code></pre>
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
      const lineSpans = Array.from({ length: totalLines }, (_, i) => `<span data-line="${i + 1}">${i + 1}</span>`).join('');
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
    <pre class="mdn-pre" tabindex="0"><code class="language-${lang}${isCustom}">${highlighted}</code></pre>
  </div>
  ${toggleCodeBtnHtml}
</div>`;
  }
