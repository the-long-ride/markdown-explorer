// ============================================================
// markdown/inline.ts — Inline-level markdown → HTML
// ============================================================

import { escHtml, escAttr } from './utils';
import { parseWikiLink } from './wikiLinks';
import { YOUTUBE_ORIGIN, YOUTUBE_WIDGET_REFERRER } from '../constants/urls';
import { AUDITED_UI_TRANSLATIONS } from '../contexts/auditedUiTranslations';
import type { AuditedUiTranslationDomains } from '../contexts/auditedUiTranslationTypes';

/**
 * Safe inline HTML tags that are passed through as-is.
 * Everything else is escaped by escHtml().
 */
const SAFE_HTML_TAG_RE = /(<\/?(kbd|sub|sup|mark|abbr|u|s|img|video|source|track|figure|figcaption|p|div|span|a|h[1-6]|details|summary|strong|em|code|pre|hr)\b[^>]*>|<br\s*\/?>)/gi;
const MDX_SAFE_HTML_TAG_RE = /(<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>|<br\s*\/?>)/gi;
const VIDEO_SOURCE_RE = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|m3u8)(?:[?#].*)?$/i;
const YOUTUBE_HOST_RE = /(^|\.)youtube(?:-nocookie)?\.com$|^youtu\.be$/i;

function bookmarkAttrs(kind: 'code' | 'math' | 'image' | 'link', identity: Record<string, string> = {}): string {
  const attrs = [`data-mdn-bookmark-kind="${kind}"`];
  for (const [name, value] of Object.entries(identity)) {
    if (value) attrs.push(`data-mdn-${name}="${escAttr(encodeURIComponent(value))}"`);
  }
  return attrs.join(' ');
}

function normalizeInlineCode(code: string): string {
  return code.replace(/[ \t]*\n[ \t]*/g, '');
}

function htmlAttribute(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function decorateSafeHtmlBookmarkTag(tag: string): string {
  if (/^<\//.test(tag) || /data-mdn-bookmark-kind=/i.test(tag)) return tag;
  const tagName = /^<([A-Za-z][A-Za-z0-9-]*)\b/.exec(tag)?.[1].toLowerCase();
  let attrs = '';
  if (tagName === 'img') {
    const url = htmlAttribute(tag, 'src');
    if (!url) return tag;
    attrs = bookmarkAttrs('image', { 'bookmark-url': url, 'bookmark-alt': htmlAttribute(tag, 'alt') });
  } else if (tagName === 'a') {
    const url = htmlAttribute(tag, 'href');
    if (!url) return tag;
    attrs = bookmarkAttrs('link', { 'bookmark-url': url });
  } else {
    return tag;
  }
  const close = tag.endsWith('/>') ? '/>' : '>';
  return `${tag.slice(0, -close.length).trimEnd()} ${attrs}${close}`;
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

function renderVideo(src: string, label: string, labels: AuditedUiTranslationDomains['rendererUi']): string {
  const cleanSrc = src.trim();
  const safeSrc = escHtml(cleanSrc);
  const caption = label.trim();
  const ariaLabel = escHtml(stripTags(caption) || labels.video);
  const captionHtml = caption ? `<figcaption class="mdn-video-caption">${caption}</figcaption>` : '';

  return `<figure class="mdn-video-wrap">
  <video class="mdn-video" controls preload="metadata" playsinline aria-label="${ariaLabel}">
    <source src="${safeSrc}" type="${videoMimeType(cleanSrc)}" />
    <a href="${safeSrc}" class="mdn-link" target="_blank" rel="noopener noreferrer">${escHtml(labels.openVideo)}</a>
  </video>
  ${captionHtml}
</figure>`;
}

function renderYouTubeEmbed(src: string, label: string, labels: AuditedUiTranslationDomains['rendererUi']): string {
  const embedSrc = getYouTubeEmbedSrc(src);
  if (!embedSrc) {
    return `<a href="${escHtml(src)}" class="mdn-link" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  const caption = label.trim();
  const title = escHtml(stripTags(caption) || labels.youtubeVideo);
  const sourceLink = `<a href="${escHtml(src)}" class="mdn-link" target="_blank" rel="noopener noreferrer">${escHtml(labels.watchOnYouTube)}</a>`;
  const captionHtml = `<figcaption class="mdn-video-caption">${caption ? `${caption} · ` : ''}${sourceLink}</figcaption>`;

  return `<figure class="mdn-video-wrap mdn-video-wrap--embed">
  <div class="mdn-video-frame">
    <iframe class="mdn-video-embed" src="${escHtml(embedSrc)}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
  ${captionHtml}
</figure>`;
}

function renderWikiSyntax(raw: string): string {
  const token = parseWikiLink(raw);
  if (!('kind' in token)) return raw;
  const target = escAttr(token.target);
  const fragmentAttr = token.fragment
    ? ` data-mdn-wiki-fragment="${escAttr(token.fragment)}"`
    : '';
  const label = escHtml(token.label ?? (token.target || token.fragment || raw));
  if (token.kind === 'embed') {
    return `<span class="mdn-wiki-embed" data-mdn-wiki-kind="embed" data-mdn-wiki-target="${target}"${fragmentAttr}>${label}</span>`;
  }
  return `<a href="#" class="mdn-wiki-link" data-mdn-wiki-kind="link" data-mdn-wiki-target="${target}"${fragmentAttr}>${label}</a>`;
}

/**
 * Render inline markdown syntax to HTML.
 * Handles: bold, italic, bold+italic, strikethrough, inline-code,
 *           images, links (internal .md and external), wiki links/embeds,
 *           auto-links, and safe HTML passthrough (kbd, sub, sup, mark, br, …).
 */
export function renderInline(
  text: string,
  isMdx = false,
  labels: AuditedUiTranslationDomains['rendererUi'] = AUDITED_UI_TRANSLATIONS.en.rendererUi,
): string {
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
      `<span class="mdn-math mdn-math-inline" ${bookmarkAttrs('math', { 'math-source': math })} data-math="${encodeURIComponent(math)}">${escHtml(math)}</span>`,
    );
  };
  const regex = isMdx ? MDX_SAFE_HTML_TAG_RE : SAFE_HTML_TAG_RE;
  const stashed = text.replace(regex, (tag) => {
    let finalTag = tag;
    if (isMdx) {
      finalTag = finalTag.replace(/([a-zA-Z0-9_-]+)\s*=\s*\{([^}]+)\}/g, (_, attrName, val) => {
        const trimmedVal = val.trim();
        if (attrName.toLowerCase().startsWith('on')) {
          const arrowMatch = /^(?:\((?:[a-zA-Z0-9_,\s]*)\)|[a-zA-Z0-9_]+)\s*=>\s*([\s\S]+)$/.exec(trimmedVal);
          if (arrowMatch) {
            return `${attrName.toLowerCase()}="${escAttr(arrowMatch[1].trim())}"`;
          }
          return `${attrName.toLowerCase()}="${escAttr(trimmedVal)}(event)"`;
        }
        if (/^(['"])(.*)\1$/.test(trimmedVal)) {
          return `${attrName}="${escAttr(trimmedVal.slice(1, -1))}"`;
        }
        return `${attrName}="${escAttr(trimmedVal)}"`;
      });

      finalTag = decorateSafeHtmlBookmarkTag(finalTag);

      if (finalTag.endsWith('/>')) {
        const tagMatch = /^<([A-Za-z][A-Za-z0-9-]*)\b([\s\S]*?)\/>$/.exec(finalTag);
        if (tagMatch) {
          const tagName = tagMatch[1];
          const attrs = tagMatch[2];
          const kebabTagName = tagName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          finalTag = `<${kebabTagName}${attrs}></${kebabTagName}>`;
        }
      } else {
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
    } else {
      finalTag = decorateSafeHtmlBookmarkTag(finalTag);
    }
    return stashHtml(finalTag);
  });

  const protectedText = stashed
    .replace(/`([^`]+)`/g, (_full, code) => stashHtml(`<code class="mdn-inline-code" ${bookmarkAttrs('code')}>${escHtml(normalizeInlineCode(code))}</code>`))
    .replace(/!?\[\[(?:\\.|[^\]])*\]\]/g, (raw) => stashHtml(renderWikiSyntax(raw)))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_full, math) => renderMath(math))
    .replace(/(^|[^\\])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_full, prefix, math) => `${prefix}${renderMath(math)}`);

  let t = escHtml(protectedText);

  t = t.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/_(.+?)_/g, '<em>$1</em>');
  t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');

  t = t.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) => {
      if (isYouTubeSource(src)) {
        stash.push(renderYouTubeEmbed(src, alt, labels));
      } else if (isVideoSource(src)) {
        stash.push(renderVideo(src, alt, labels));
      } else {
        stash.push(`<img alt="${alt}" src="${src}" class="mdn-img" loading="lazy" ${bookmarkAttrs('image', { 'bookmark-alt': alt, 'bookmark-url': src })} />`);
      }
      return `\u0001${stash.length - 1}\u0001`;
    },
  );

  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label, href) => {
    let linkHtml = '';
    if (isYouTubeSource(href)) {
      linkHtml = renderYouTubeEmbed(href, label, labels);
    } else if (isVideoSource(href)) {
      linkHtml = renderVideo(href, label, labels);
    } else if (href.endsWith('.md') || href.includes('.md#')) {
      linkHtml = `<a href="#" class="mdn-link mdn-link--internal" ${bookmarkAttrs('link', { 'bookmark-label': label, 'bookmark-url': href })} data-mdn-target="${escHtml(href)}" onclick="Nav.go('${escAttr(href)}');return false;">${label}</a>`;
    } else {
      linkHtml = `<a href="${href}" class="mdn-link" ${bookmarkAttrs('link', { 'bookmark-label': label, 'bookmark-url': href })} target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    stash.push(linkHtml);
    return `\u0001${stash.length - 1}\u0001`;
  });

  t = t.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (_full, href) => (
      isYouTubeSource(href)
        ? renderYouTubeEmbed(href, href, labels)
        : isVideoSource(href)
        ? renderVideo(href, href, labels)
        : `<a href="${href}" class="mdn-link" ${bookmarkAttrs('link', { 'bookmark-label': href, 'bookmark-url': href })} target="_blank" rel="noopener noreferrer">${href}</a>`
    ),
  );

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
