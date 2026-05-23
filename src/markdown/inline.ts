// ============================================================
// markdown/inline.ts — Inline-level markdown → HTML
// ============================================================

import { escHtml, escAttr } from '../utils';

/**
 * Safe inline HTML tags that are passed through as-is.
 * Everything else is escaped by escHtml().
 */
const SAFE_HTML_TAG_RE = /(<\/?(kbd|sub|sup|mark|abbr|u|s|img|p|div|span|a|h[1-6]|details|summary|strong|em|code|pre|hr)\b[^>]*>|<br\s*\/?>)/gi;

/**
 * Render inline markdown syntax to HTML.
 * Handles: bold, italic, bold+italic, strikethrough, inline-code,
 *           images, links (internal .md and external), auto-links,
 *           and safe HTML passthrough (kbd, sub, sup, mark, br, …).
 */
export function renderInline(text: string): string {
  if (!text) return '';

  // ── Step 0: Stash safe HTML tags so escHtml() can't destroy them ──
  const stash: string[] = [];
  const stashed = text.replace(SAFE_HTML_TAG_RE, (tag) => {
    stash.push(tag);
    return `\u0001${stash.length - 1}\u0001`;
  });

  // ── Step 1: Escape remaining HTML entities ──
  let t = escHtml(stashed);

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

  // ── Step 6: Inline code (`...`) — before link processing ──
  t = t.replace(/`([^`]+)`/g, '<code class="mdn-inline-code">$1</code>');

  // ── Step 7: Images  ![alt](src) ──
  t = t.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) => {
      stash.push(`<img alt="${alt}" src="${src}" class="mdn-img" loading="lazy" />`);
      return `\u0001${stash.length - 1}\u0001`;
    },
  );

  // ── Step 8: Links  [label](href) ──
  //    Internal .md links → Nav.go(); external → new tab
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label, href) => {
    let linkHtml = '';
    if (href.endsWith('.md') || href.includes('.md#')) {
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
    '<a href="$1" class="mdn-link" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // ── Step 10: Restore stashed safe HTML tags recursively ──
  while (t.includes('\u0001')) {
    t = t.replace(/\u0001(\d+)\u0001/g, (_, i) => stash[+i]);
  }

  return t;
}
