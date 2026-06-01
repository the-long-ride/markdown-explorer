import type { CodeBlockToken } from './parser';
import { highlight } from './highlighter';
import { escHtml, renderButton, shortId } from '../utils';
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
      const wrappedDoc = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
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
        const lineSpans = Array.from({ length: totalLines }, (_, i) => `<span data-line="${i + 1}">${i + 1}</span>`).join('');
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
