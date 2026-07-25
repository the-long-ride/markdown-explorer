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
  const theme = options.theme || 'auto';
  const target = options.target || 'inline';
  const baseTag = options.baseHref
    ? `<base href="${escapeAttribute(options.baseHref)}" />\n`
    : '';
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
      if (event.data && event.data.type === 'set-theme') {
        document.documentElement.setAttribute('data-theme', event.data.theme);
        setTimeout(sendHeight, 50);
      } else if (event.data && event.data.type === 'recalculate-height') {
        sendHeight();
      }
    });
  })();
</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${escapeAttribute(theme)}">
<head>
<meta charset="UTF-8" />
${baseTag}<meta name="viewport" content="width=device-width, initial-scale=1" />
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
  html, body { min-height: 100%; }
  body {
    box-sizing: border-box;
    margin: 0;
    padding: 16px;
    font-family: var(--font-ui);
    color: var(--tx);
    background: ${target === 'inline' ? 'transparent' : 'var(--bg)'};
  }
</style>
</head>
<body>
${content}
${resizeScript}
</body>
</html>`;
}
