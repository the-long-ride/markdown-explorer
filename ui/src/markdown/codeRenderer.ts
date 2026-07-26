import type { CodeBlockToken } from './parser';
import { highlight } from './highlighter';
import { escHtml, renderButton, shortId } from './utils';
import { buildHtmlPreviewDocument, hasRenderableHtmlContent } from './htmlPreviewDocument';
import { parseDelimitedFenceInfo, parseDelimitedText, tokenizeDelimitedSource } from './delimitedText';
import { renderInteractiveTable } from './tableRenderer';

export interface CodeRendererOptions {
  theme?: string;
  isMdx?: boolean;
  defaultHtmlPreview?: boolean;
  defaultCsvPreview?: boolean;
}

const EYE_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const CODE_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>';
const COPY_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const OPEN_BROWSER_ICON = '<svg width="13" height="13" viewBox="0 0 122.88 113.6" fill="currentColor"><path d="M71.89,100.56q-3.86,3.82-8.37,7.63c1.26-.17,2.52-.38,3.74-.62a49.38,49.38,0,0,0,7.08-2c.14.22.28.43.43.64.37.51.71.94,1,1.27l0,0,0,0a16.4,16.4,0,0,0,2.13,2,55.29,55.29,0,0,1-9.73,2.92,58.73,58.73,0,0,1-22.83,0,53.48,53.48,0,0,1-10.6-3.27.26.26,0,0,1-.14-.07A62.1,62.1,0,0,1,25,103.89,54.41,54.41,0,0,1,16.6,97a52.69,52.69,0,0,1-6.89-8.38A59.79,59.79,0,0,1,4.46,79,55.79,55.79,0,0,1,1.12,68.22a58.73,58.73,0,0,1,0-22.83A52.86,52.86,0,0,1,4.4,34.79a.33.33,0,0,1,.06-.14A60.34,60.34,0,0,1,9.71,25a54,54,0,0,1,6.89-8.39A52.19,52.19,0,0,1,25,9.71a59.7,59.7,0,0,1,9.67-5.25A54.52,54.52,0,0,1,45.39,1.12a58.73,58.73,0,0,1,22.83,0,53.89,53.89,0,0,1,10.6,3.27.28.28,0,0,1,.13.07,61.75,61.75,0,0,1,9.68,5.25A54.41,54.41,0,0,1,97,16.59,52.27,52.27,0,0,1,103.89,25a58.19,58.19,0,0,1,5.25,9.67,54.52,54.52,0,0,1,3.34,10.74l.12.6-5.42-1.53a47,47,0,0,0-2.6-7.83,54.22,54.22,0,0,0-2.87-5.76H85.08a65.47,65.47,0,0,1,4.2,8.49c-2.07-.57-4.13-1.13-6.16-1.66a65.73,65.73,0,0,0-3.86-6.83h-20v3.41l-.61.22a13.48,13.48,0,0,0-4.36,2.68V30.87h-20q-7.67,11.91-8.62,23.44H51.24q1,2.47,2.09,5H25.62c.31,7.87,3,15.67,7.88,23.44H54.32V61.56c1.59,3.63,3.27,7.29,5,11V82.73h4.76c.77,1.66,1.53,3.31,2.29,5H59.29v17.51a123.84,123.84,0,0,0,10.53-9.65q1.05,2.49,2.07,5ZM114.75,98a4.64,4.64,0,0,1-1.17.79l-.08,0a4.14,4.14,0,0,1-4.36-.6l-11.6-9.84-4,9.77a12.93,12.93,0,0,1-1.19,2.25,9.1,9.1,0,0,1-1.51,1.76,4.78,4.78,0,0,1-7.5-.82,9.28,9.28,0,0,1-.92-1.63c-6.9-17.49-16.26-34.9-23.26-52.4A3.11,3.11,0,0,1,62.65,43c16.77,3.1,38.5,10.19,55.55,14.71,5.3,1.4,6.16,6.07,2.25,9.69a12.21,12.21,0,0,1-2,1.52c-3,1.7-6,3.67-9,5.47l11.55,9.9a4.25,4.25,0,0,1,1,1.26l0,.08a4.28,4.28,0,0,1,.39,1.47v0a4.26,4.26,0,0,1-.16,1.54,4.39,4.39,0,0,1-.72,1.39A94.55,94.55,0,0,1,114.75,98Zm-3-3.84,5.59-6.56c-2.46-2.11-13-10.29-14.09-12.26a2.41,2.41,0,0,1,.83-3.25c3.66-2,8.36-4.86,11.83-7.17a8.38,8.38,0,0,0,1.22-.89,4.42,4.42,0,0,0,.75-.87l.16-.3-.31-.18a3.92,3.92,0,0,0-.76-.26L65,48.6,86.83,97.74a4.8,4.8,0,0,0,.38.7l.22.29.28-.2a4.51,4.51,0,0,0,.73-.89,7.51,7.51,0,0,0,.68-1.33c1.63-4,3.49-9.47,5.4-13.17l.23-.32a2.4,2.4,0,0,1,3.37-.27l13.64,11.57ZM50.13,108.19A105.56,105.56,0,0,1,30.87,87.71H15.16a51.5,51.5,0,0,0,12.61,12,52.81,52.81,0,0,0,8.89,4.8s.07,0,.11.07a49.13,49.13,0,0,0,9.64,3c1.23.24,2.49.45,3.75.62ZM11.89,82.73H27.7a50.6,50.6,0,0,1-7-23.44H5a55.75,55.75,0,0,0,1,7.94A48.27,48.27,0,0,0,9,77a54.16,54.16,0,0,0,2.86,5.76ZM5,54.31H20.75a54.38,54.38,0,0,1,7.77-23.44H11.89A54.16,54.16,0,0,0,9,36.63s0,.07-.07.1a49.91,49.91,0,0,0-3,9.65,51.46,51.46,0,0,0-1,7.93ZM15.13,25.9H31.72A117.72,117.72,0,0,1,50.46,5.35c-1.39.17-2.76.37-4.08.65a48.36,48.36,0,0,0-9.75,3,55.24,55.24,0,0,0-8.89,4.8,51.5,51.5,0,0,0-12.61,12v0Zm48-20.55A114.63,114.63,0,0,1,81.88,25.9h16.6a48.63,48.63,0,0,0-5-5.76,49.81,49.81,0,0,0-7.63-6.27A53.27,53.27,0,0,0,77,9.06s-.06,0-.1-.06a49.15,49.15,0,0,0-9.64-3c-1.36-.27-2.73-.48-4.09-.65v0ZM59.29,8.59V25.9H75.78A115.68,115.68,0,0,0,59.29,8.59Zm-5,96.63V87.71H37a105.67,105.67,0,0,0,17.35,17.51Zm0-79.32V8.59A116.3,116.3,0,0,0,37.82,25.9Z"/></svg>';
const OPEN_MODAL_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M15 12h3v3M18 12l-5 5"/></svg>';

function normalizeOptions(themeOrOptions: string | CodeRendererOptions): Required<CodeRendererOptions> {
  if (typeof themeOrOptions === 'string') {
    return {
      theme: themeOrOptions,
      isMdx: false,
      defaultHtmlPreview: true,
      defaultCsvPreview: true,
    };
  }
  return {
    theme: themeOrOptions.theme || 'auto',
    isMdx: themeOrOptions.isMdx || false,
    defaultHtmlPreview: themeOrOptions.defaultHtmlPreview !== false,
    defaultCsvPreview: themeOrOptions.defaultCsvPreview !== false,
  };
}

function renderCopyButton(): string {
  return renderButton({
    className: 'mdn-copy-btn',
    onClick: 'UI.copyCode(this)',
    label: 'Copy code',
    tooltip: 'Copy code',
    title: 'Copy code',
    ariaLabel: 'Copy code',
    dataI18nKey: 'copyCode',
    iconHtml: COPY_ICON,
  });
}

function renderPreviewToggle(className: string, handler: string, showCodeByDefault: boolean): string {
  const label = showCodeByDefault ? 'Show Preview' : 'Show Code';
  return renderButton({
    className,
    onClick: handler,
    label,
    tooltip: label,
    title: label,
    ariaLabel: label,
    dataI18nKey: showCodeByDefault ? 'showPreview' : 'showCode',
    iconHtml: showCodeByDefault ? EYE_ICON : CODE_ICON,
  });
}

function renderCodeBody(
  token: CodeBlockToken,
  language: string,
  allowLineNumbers = true,
  highlightedOverride?: string,
): {
  body: string;
  collapseButton: string;
  totalLines: number;
} {
  const highlighted = highlightedOverride ?? highlight(token.content, token.lang);
  const customClass = highlighted !== escHtml(token.content) ? ' is-custom-highlighted' : '';
  const lines = token.content.split('\n');
  const totalLines = lines.length;
  const lineNumbers = allowLineNumbers && token.content.trim() !== ''
    ? `<div class="mdn-codeblock-gutter">${Array.from({ length: totalLines }, (_, index) => `<span data-line="${index + 1}">${index + 1}</span>`).join('')}</div>`
    : '';
  return {
    body: `<div class="mdn-codeblock-body">
    ${lineNumbers}
    <pre class="mdn-pre" tabindex="0"><code class="language-${language}${customClass}">${highlighted}</code></pre>
  </div>`,
    collapseButton: totalLines > 20
      ? '<button class="mdn-codeblock-toggle-btn" onclick="UI.toggleCodeCollapse(this)">Show More</button>'
      : '',
    totalLines,
  };
}

function renderHtmlCodeBlock(token: CodeBlockToken, options: Required<CodeRendererOptions>): string {
  const iframeId = shortId('html');
  const wrappedDocument = buildHtmlPreviewDocument(token.content, {
    theme: options.theme,
    iframeId,
    target: 'inline',
  });
  const showCodeByDefault = !options.defaultHtmlPreview || !hasRenderableHtmlContent(token.content);
  const code = renderCodeBody(token, 'html');
  const openBrowser = renderButton({
    className: 'mdn-open-browser-btn',
    onClick: 'UI.openHtmlPreview(this)',
    label: 'Open in browser',
    tooltip: 'Open in browser',
    title: 'Open in browser',
    ariaLabel: 'Open in browser',
    dataI18nKey: 'openInBrowser',
    iconHtml: OPEN_BROWSER_ICON,
  });
  const openModal = renderButton({
    className: 'mdn-open-modal-btn',
    onClick: 'UI.openHtmlPreviewModal(this)',
    label: 'Open as modal',
    tooltip: 'Open as modal',
    title: 'Open as modal',
    ariaLabel: 'Open as modal',
    dataI18nKey: 'openAsModal',
    iconHtml: OPEN_MODAL_ICON,
  });
  const toggle = renderPreviewToggle('mdn-toggle-preview-btn', 'UI.toggleHtmlMode(this)', showCodeByDefault);

  return `<div class="mdn-codeblock mdn-html-preview-wrap" data-preview-theme="${escHtml(options.theme)}" data-mode="${showCodeByDefault ? 'code' : 'preview'}"${code.totalLines > 20 ? ' data-collapsed="true"' : ''}>
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang" data-code-label="HTML" data-preview-label="HTML Preview">${showCodeByDefault ? 'HTML' : 'HTML Preview'}</span>
    <div class="mdn-codeblock-actions">${openBrowser}${openModal}${toggle}${renderCopyButton()}</div>
  </div>
  <div class="mdn-html-preview-body" style="${showCodeByDefault ? 'display:none' : ''}">
    <iframe id="${iframeId}" class="mdn-html-preview-iframe" sandbox="allow-scripts" srcdoc="${escHtml(wrappedDocument)}"></iframe>
    <template class="mdn-html-preview-source">${escHtml(token.content)}</template>
  </div>
  <div class="mdn-code-source" style="${showCodeByDefault ? '' : 'display:none'}">${code.body}</div>
  ${code.collapseButton}
</div>`;
}

function warningMarkup(warnings: readonly string[]): string {
  return warnings.map((warning) => {
    const key = warning === 'malformedQuote' ? 'csvMalformedQuote' : 'csvUnevenRows';
    const fallback = warning === 'malformedQuote'
      ? 'Some quoted CSV fields are malformed. Review the source code.'
      : 'Some CSV rows have a different number of columns.';
    return `<div class="mdn-csv-warning" role="status" data-i18n-content-key="${key}">${fallback}</div>`;
  }).join('');
}

function renderDelimitedCodeBlock(token: CodeBlockToken, options: Required<CodeRendererOptions>): string {
  const language = token.lang.toLowerCase() === 'tsv' ? 'TSV' : 'CSV';
  const fenceInfo = `${token.lang || 'csv'}${token.meta ? ` ${token.meta}` : ''}`;
  const parsed = parseDelimitedText(token.content, parseDelimitedFenceInfo(fenceInfo));
  const showCodeByDefault = !options.defaultCsvPreview;
  const decoratedSource = tokenizeDelimitedSource(token.content, parsed.delimiter)
    .map((segment) => segment.kind === 'field'
      ? `<span class="code-delimited-column code-delimited-column--${segment.columnIndex % 4}">${escHtml(segment.text)}</span>`
      : escHtml(segment.text))
    .join('');
  const code = renderCodeBody(token, language.toLowerCase(), true, decoratedSource);
  const toggle = renderPreviewToggle('mdn-toggle-csv-btn', 'UI.toggleCsvMode(this)', showCodeByDefault);
  const previewLabel = `${language} Preview`;
  const table = renderInteractiveTable({ headers: parsed.headers, rows: parsed.rows }, options.isMdx);

  return `<div class="mdn-codeblock mdn-csv-preview-wrap" data-mode="${showCodeByDefault ? 'code' : 'preview'}"${code.totalLines > 20 ? ' data-collapsed="true"' : ''}>
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang" data-code-label="${language}" data-preview-label="${previewLabel}" data-i18n-preview-key="${language === 'TSV' ? 'tsvPreviewTitle' : 'csvPreviewTitle'}">${showCodeByDefault ? language : previewLabel}</span>
    <div class="mdn-codeblock-actions">${toggle}${renderCopyButton()}</div>
  </div>
  <div class="mdn-csv-preview-body" style="${showCodeByDefault ? 'display:none' : ''}">
    ${warningMarkup(parsed.warnings)}
    ${table}
  </div>
  <div class="mdn-code-source" style="${showCodeByDefault ? '' : 'display:none'}">${code.body}</div>
  ${code.collapseButton}
</div>`;
}

export function renderCodeBlock(token: CodeBlockToken, themeOrOptions: string | CodeRendererOptions): string {
  const options = normalizeOptions(themeOrOptions);
  const rawLanguage = token.lang || 'text';
  const language = escHtml(rawLanguage);
  const lowerLanguage = rawLanguage.toLowerCase();
  const firstWord = token.content.trim().split(/[\s\n\r]/)[0];
  const mermaidKeywords = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
    'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart',
    'xychart-beta', 'mindmap', 'timeline', 'gitGraph', 'sankey-beta',
    'block', 'block-beta', 'packet', 'packet-beta', 'kanban', 'architecture', 'architecture-beta',
    'zenuml', 'requirementDiagram', 'info', 'C4Context', 'C4Container', 'C4Component',
    'C4Dynamic', 'C4Deployment',
  ];
  const isMermaid = lowerLanguage === 'mermaid'
    || ((!token.lang || lowerLanguage === 'text') && mermaidKeywords.includes(firstWord));
  if (isMermaid) {
    return `<div class="mdn-mermaid-wrap">
  <div class="mermaid">${token.content}</div>
</div>`;
  }
  if (lowerLanguage === 'html') return renderHtmlCodeBlock(token, options);
  if (lowerLanguage === 'csv' || lowerLanguage === 'tsv') return renderDelimitedCodeBlock(token, options);

  const code = renderCodeBody(token, lowerLanguage === 'text' ? 'text' : language, lowerLanguage !== 'text');
  const plainText = lowerLanguage === 'text' || !token.lang;
  return `<div class="mdn-codeblock"${code.totalLines > 20 ? ' data-collapsed="true"' : ''}>
  <div class="mdn-codeblock-header">
    <span class="mdn-codeblock-lang"${plainText ? ' data-i18n-content-key="plainText"' : ''}>${plainText ? 'PLAIN TEXT' : language}</span>
    ${renderCopyButton()}
  </div>
  ${code.body}
  ${code.collapseButton}
</div>`;
}
