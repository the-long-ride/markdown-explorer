export type HtmlPreviewTarget = 'inline' | 'modal' | 'external';

const NON_RENDERING_HTML_TAGS = new Set([
  'html', 'head', 'meta', 'link', 'base', 'title', 'style', 'script', 'template', 'noscript',
]);

/** Return true when an HTML code block has visible or potentially rendered body content. */
export function hasRenderableHtmlContent(content: string): boolean {
  const source = String(content || '').trim();
  if (!source) return false;

  const remaining = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, '')
    .replace(/<(script|style|template|noscript|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:meta|link|base)\b[^>]*\/?\s*>/gi, '')
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '')
    .trim();
  if (!remaining) return false;
  if (remaining.replace(/<[^>]+>/g, '').trim()) return true;

  const openingTags = remaining.match(/<([a-z][a-z0-9:-]*)\b[^>]*>/gi) || [];
  return openingTags.some((tagSource) => {
    const match = /^<([a-z][a-z0-9:-]*)/i.exec(tagSource);
    return !!match && !NON_RENDERING_HTML_TAGS.has(match[1].toLowerCase());
  });
}

export interface HtmlPreviewDocumentOptions {
  theme?: string;
  iframeId?: string;
  target?: HtmlPreviewTarget;
  baseHref?: string | null;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildHtmlPreviewDocument(
  content: string,
  options: HtmlPreviewDocumentOptions = {},
): string {
  const target = options.target || 'inline';
  const baseTag = options.baseHref
    ? `<base href="${escapeAttribute(options.baseHref)}" />\n`
    : '';
  const networkGuard = `<script data-mdn-network-guard>
(function () {
  function blocked(name) {
    return function () { throw new Error('Markdown Explorer local-first preview blocked ' + name + '.'); };
  }
  try { Object.defineProperty(window, 'fetch', { configurable: false, writable: false, value: blocked('fetch') }); } catch (_) {}
  try { Object.defineProperty(window, 'XMLHttpRequest', { configurable: false, writable: false, value: blocked('XMLHttpRequest') }); } catch (_) {}
  try { Object.defineProperty(window, 'WebSocket', { configurable: false, writable: false, value: blocked('WebSocket') }); } catch (_) {}
  try { Object.defineProperty(window, 'EventSource', { configurable: false, writable: false, value: blocked('EventSource') }); } catch (_) {}
  try { Object.defineProperty(navigator, 'sendBeacon', { configurable: false, writable: false, value: blocked('sendBeacon') }); } catch (_) {}
})();
</script>`;
  const resizeScript = target === 'inline' && options.iframeId
    ? `<script data-mdn-inline-resize>
  (function() {
    function sendHeight() {
      window.parent.postMessage({
        type: 'resize-iframe',
        id: '${options.iframeId}',
        height: document.documentElement.scrollHeight || document.body.scrollHeight
      }, '*');
    }
    window.addEventListener('load', sendHeight);
    window.addEventListener('DOMContentLoaded', sendHeight);
    let lastHeight = 0;
    setInterval(function() {
      const currentHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      if (currentHeight !== lastHeight) {
        lastHeight = currentHeight;
        sendHeight();
      }
    }, 100);
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'recalculate-height') sendHeight();
    });
  })();
</script>`
    : '';

  const themeAttr = options.theme && options.theme !== 'auto'
    ? ` data-theme="${escapeAttribute(options.theme)}"`
    : '';

  return `<!DOCTYPE html>
<html lang="en"${themeAttr}>
<head>
<meta charset="UTF-8" />
${baseTag}<meta name="viewport" content="width=device-width, initial-scale=1" />
${networkGuard}
</head>
<body>
${content}
${resizeScript}
</body>
</html>`;
}
