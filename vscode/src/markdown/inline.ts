// ============================================================
// markdown/inline.ts — Inline-level markdown → HTML
// ============================================================

import { escHtml, escAttr } from '../utils';

/**
 * Safe inline HTML tags that are passed through as-is.
 * Everything else is escaped by escHtml().
 */
const SAFE_HTML_TAG_RE = /(<\/?(kbd|sub|sup|mark|abbr|u|s|img|video|source|track|figure|figcaption|p|div|span|a|h[1-6]|details|summary|strong|em|code|pre|hr)\b[^>]*>|<br\s*\/?>)/gi;
const MDX_SAFE_HTML_TAG_RE = /(<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>|<br\s*\/?>)/gi;
const VIDEO_SOURCE_RE = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|m3u8)(?:[?#].*)?$/i;
const YOUTUBE_HOST_RE = /(^|\.)youtube(?:-nocookie)?\.com$|^youtu\.be$/i;
const YOUTUBE_WIDGET_REFERRER = 'https://the-long-ride.github.io/markdown-explorer/';
const YOUTUBE_ORIGIN = 'https://the-long-ride.github.io';

function normalizeInlineCode(code: string): string {
  return code.replace(/[ \t]*\n[ \t]*/g, '');
}

function isVideoSource(src: string): boolean {
  return VIDEO_SOURCE_RE.test(src.trim());
}

function getYouTubeEmbedSrc(src: string): string | null {
  try {
    const url = new URL(src.trim());
    if (!YOUTUBE_HOST_RE.test(url.hostname)) return null;

    let videoId = '';
    if (url.hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v') || '';
    } else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) {
        videoId = parts[1] || '';
      }
    }

    if (!/^[\w-]{6,}$/.test(videoId)) return null;

    const params = new URLSearchParams();
    const playlist = url.searchParams.get('list');
    const start = url.searchParams.get('start') || url.searchParams.get('t');
    params.set('origin', YOUTUBE_ORIGIN);
    params.set('widget_referrer', YOUTUBE_WIDGET_REFERRER);
    params.set('playsinline', '1');
    if (playlist) params.set('list', playlist);
    if (start && /^\d+s?$/.test(start)) params.set('start', start.replace(/s$/, ''));

    const suffix = params.toString() ? `?${params.toString()}` : '';
    return `https://www.youtube.com/embed/${videoId}${suffix}`;
  } catch {
    return null;
  }
}

function isYouTubeSource(src: string): boolean {
  return getYouTubeEmbedSrc(src) !== null;
}

function videoMimeType(src: string): string {
  const cleanSrc = src.split(/[?#]/, 1)[0].toLowerCase();
  if (cleanSrc.endsWith('.mp4') || cleanSrc.endsWith('.m4v') || cleanSrc.endsWith('.mov')) return 'video/mp4';
  if (cleanSrc.endsWith('.webm')) return 'video/webm';
  if (cleanSrc.endsWith('.ogv') || cleanSrc.endsWith('.ogg')) return 'video/ogg';
  if (cleanSrc.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  return 'video/mp4';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function renderVideo(src: string, label: string): string {
  const cleanSrc = src.trim();
  const safeSrc = escHtml(cleanSrc);
  const caption = label.trim();
  const ariaLabel = escHtml(stripTags(caption) || 'Video');
  const captionHtml = caption ? `<figcaption class="mdn-video-caption">${caption}</figcaption>` : '';

  return `<figure class="mdn-video-wrap">
  <video class="mdn-video" controls preload="metadata" playsinline aria-label="${ariaLabel}">
    <source src="${safeSrc}" type="${videoMimeType(cleanSrc)}" />
    <a href="${safeSrc}" class="mdn-link" target="_blank" rel="noopener noreferrer">Open video</a>
  </video>
  ${captionHtml}
</figure>`;
}

function renderYouTubeEmbed(src: string, label: string): string {
  const embedSrc = getYouTubeEmbedSrc(src);
  if (!embedSrc) {
    return `<a href="${escHtml(src)}" class="mdn-link" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  const caption = label.trim();
  const title = escHtml(stripTags(caption) || 'YouTube video');
  const sourceLink = `<a href="${escHtml(src)}" class="mdn-link" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>`;
  const captionHtml = `<figcaption class="mdn-video-caption">${caption ? `${caption} · ` : ''}${sourceLink}</figcaption>`;

  return `<figure class="mdn-video-wrap mdn-video-wrap--embed">
  <div class="mdn-video-frame">
    <iframe class="mdn-video-embed" src="${escHtml(embedSrc)}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
  ${captionHtml}
</figure>`;
}

/**
 * Render inline markdown syntax to HTML.
 * Handles: bold, italic, bold+italic, strikethrough, inline-code,
 *           images, links (internal .md and external), auto-links,
 *           and safe HTML passthrough (kbd, sub, sup, mark, br, …).
 */
export function renderInline(text: string, isMdx = false): string {
  if (!text) return '';

  // ── Step 0: Stash safe HTML tags so escHtml() can't destroy them ──
  const stash: string[] = [];
  const stashHtml = (html: string) => {
    stash.push(html);
    return `\u0001${stash.length - 1}\u0001`;
  };
  const renderMath = (source: string) => {
    const math = source.trim();
    return stashHtml(
      `<span class="mdn-math mdn-math-inline" data-math="${encodeURIComponent(math)}">${escHtml(math)}</span>`,
    );
  };
  const regex = isMdx ? MDX_SAFE_HTML_TAG_RE : SAFE_HTML_TAG_RE;
  const stashed = text.replace(regex, (tag) => {
    let finalTag = tag;
    if (isMdx) {
      // Clean up self-closing JSX elements and curly braced attributes
      // 1. Replace curly braces: attr={value} -> attr="value"
      // and event handlers: onClick={() => code} -> onclick="code"
      finalTag = finalTag.replace(/([a-zA-Z0-9_-]+)\s*=\s*\{([^}]+)\}/g, (_, attrName, val) => {
        const trimmedVal = val.trim();
        // Event handlers
        if (attrName.toLowerCase().startsWith('on')) {
          // Check if it's an arrow function: () => ... or (e) => ...
          const arrowMatch = /^(?:\((?:[a-zA-Z0-9_,\s]*)\)|[a-zA-Z0-9_]+)\s*=>\s*([\s\S]+)$/.exec(trimmedVal);
          if (arrowMatch) {
            return `${attrName.toLowerCase()}="${escAttr(arrowMatch[1].trim())}"`;
          }
          // Non-arrow function identifier
          return `${attrName.toLowerCase()}="${escAttr(trimmedVal)}(event)"`;
        }
        // String literal in curly braces
        if (/^(['"])(.*)\1$/.test(trimmedVal)) {
          return `${attrName}="${escAttr(trimmedVal.slice(1, -1))}"`;
        }
        return `${attrName}="${escAttr(trimmedVal)}"`;
      });

      // 2. Convert self-closing tags to explicit closing tags
      if (finalTag.endsWith('/>')) {
        const tagMatch = /^<([A-Za-z][A-Za-z0-9-]*)\b([\s\S]*?)\/>$/.exec(finalTag);
        if (tagMatch) {
          const tagName = tagMatch[1];
          const attrs = tagMatch[2];
          const kebabTagName = tagName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          finalTag = `<${kebabTagName}${attrs}></${kebabTagName}>`;
        }
      } else {
        // Convert regular opening/closing tags if they have uppercase letters
        const tagMatch = /^<\/?([A-Za-z][A-Za-z0-9-]*)\b([\s\S]*?)>$/.exec(finalTag);
        if (tagMatch) {
          const tagName = tagMatch[1];
          const kebabTagName = tagName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          if (finalTag.startsWith('</')) {
            finalTag = `</${kebabTagName}>`;
          } else {
            const attrs = tagMatch[2];
            finalTag = `<${kebabTagName}${attrs}>`;
          }
        }
      }
    }
    return stashHtml(finalTag);
  });

  const protectedText = stashed
    .replace(/`([^`]+)`/g, (_full, code) => stashHtml(`<code class="mdn-inline-code">${escHtml(normalizeInlineCode(code))}</code>`))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_full, math) => renderMath(math))
    .replace(/(^|[^\\])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_full, prefix, math) => `${prefix}${renderMath(math)}`);

  // ── Step 1: Escape remaining HTML entities ──
  let t = escHtml(protectedText);

  // ── Step 2: Bold + italic (*** ... ***) ──
  t = t.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');

  // ── Step 3: Bold (** ... ** or __ ... __) ──
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // ── Step 4: Italic (* ... * or _ ... _) ──
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/_(.+?)_/g, '<em>$1</em>');

  // ── Step 5: Strikethrough (~~...~~) ──
  t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // ── Step 7: Images  ![alt](src) ──
  t = t.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) => {
      if (isYouTubeSource(src)) {
        stash.push(renderYouTubeEmbed(src, alt));
      } else if (isVideoSource(src)) {
        stash.push(renderVideo(src, alt));
      } else {
        stash.push(`<img alt="${alt}" src="${src}" class="mdn-img" loading="lazy" />`);
      }
      return `\u0001${stash.length - 1}\u0001`;
    },
  );

  // ── Step 8: Links  [label](href) ──
  //    Internal .md links → Nav.go(); external → new tab
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label, href) => {
    let linkHtml = '';
    if (isYouTubeSource(href)) {
      linkHtml = renderYouTubeEmbed(href, label);
    } else if (isVideoSource(href)) {
      linkHtml = renderVideo(href, label);
    } else if (href.endsWith('.md') || href.includes('.md#')) {
      linkHtml = `<a href="#" class="mdn-link mdn-link--internal" onclick="Nav.go('${escAttr(href)}');return false;">${label}</a>`;
    } else {
      linkHtml = `<a href="${href}" class="mdn-link" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    stash.push(linkHtml);
    return `\u0001${stash.length - 1}\u0001`;
  });

  // ── Step 9: Bare URLs ──
  t = t.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (_full, href) => (
      isYouTubeSource(href)
        ? renderYouTubeEmbed(href, href)
        : isVideoSource(href)
        ? renderVideo(href, href)
        : `<a href="${href}" class="mdn-link" target="_blank" rel="noopener noreferrer">${href}</a>`
    ),
  );

  // ── Step 10: Restore stashed safe HTML tags recursively ──
  let replaced = true;
  let depth = 0;
  while (t.includes('\u0001') && replaced && depth < 100) {
    replaced = false;
    t = t.replace(/\u0001(\d+)\u0001/g, (_, i) => {
      replaced = true;
      return stash[+i] ?? '';
    });
    depth++;
  }

  return t;
}
