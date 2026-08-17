export function injectBaseHref(documentHtml: string, baseHref: string | null): string {
  if (!baseHref || !baseHref.trim()) return documentHtml;
  const sanitized = baseHref.trim().replace(/"/g, '&quot;');
  const baseTag = `<base href="${sanitized}">`;
  const headMatch = /<head\b[^>]*>/i.exec(documentHtml);
  if (headMatch) {
    const insertIndex = headMatch.index + headMatch[0].length;
    return `${documentHtml.slice(0, insertIndex)}${baseTag}${documentHtml.slice(insertIndex)}`;
  }
  return `${baseTag}${documentHtml}`;
}

export function isWorkspaceNavigationHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#" || trimmed.startsWith("#")) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return false;
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  );
}


export function splitLeadingHtmlComments(html: string): { leadingCommentsHtml: string; bodyHtml: string } {
  const leadingComments: string[] = [];
  let remaining = html;
  const commentPattern = /^\s*(<div\s+class=(?:"[^"\n]*\bmdn-html-comment\b[^"\n]*"|\'[^\'\n]*\bmdn-html-comment\b[^\'\n]*\')[^>]*>[\s\S]*?<\/div>)\s*/;

  while (true) {
    const match = commentPattern.exec(remaining);
    if (!match) break;
    leadingComments.push(match[1]);
    remaining = remaining.slice(match[0].length);
  }

  return {
    leadingCommentsHtml: leadingComments.join('\n'),
    bodyHtml: remaining,
  };
}

export function syncStickyTableHeaders(scrollContainer: HTMLElement | null): void {
  if (!scrollContainer) return;
  const rectScroll = scrollContainer.getBoundingClientRect();
  const stickyTop = rectScroll.top;

  scrollContainer
    .querySelectorAll<HTMLTableElement>(".mdn-table")
    .forEach((table) => {
      const thead = table.querySelector<HTMLElement>("thead");
      if (!thead) return;
      const rectTable = table.getBoundingClientRect();
      const offsetPast = stickyTop - rectTable.top;
      if (offsetPast > 0) {
        const maxTranslate = table.offsetHeight - thead.offsetHeight;
        const translateY = Math.min(offsetPast, maxTranslate);
        thead.style.transform = `translateY(${translateY}px)`;
        thead.style.position = "relative";
        thead.style.zIndex = "10";
      } else {
        thead.style.transform = "";
        thead.style.position = "";
        thead.style.zIndex = "";
      }
    });
}

export function buildRenderedDocumentSnapshot(
  contentHtml: string,
  title: string,
  baseHref: string | null,
  fragment: string,
): string {
  const safeTitle = title.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
  const hash = fragment.startsWith('#') ? fragment : '';
  const scriptHash = JSON.stringify(hash)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const snapshot = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html{scroll-behavior:smooth}body{max-width:960px;margin:0 auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:#202124;background:#fff}img,video,svg{max-width:100%;height:auto}pre{overflow:auto;padding:16px;border-radius:8px;background:#f5f5f5}table{border-collapse:collapse;max-width:100%}th,td{border:1px solid #d7d7d7;padding:6px 10px}@media(prefers-color-scheme:dark){body{color:#eceff4;background:#181a1f}pre{background:#24272e}th,td{border-color:#4b505c}}</style></head><body>${contentHtml}<script>window.addEventListener('load',function(){var hash=${scriptHash};if(hash){location.hash=hash;var target=document.getElementById(decodeURIComponent(hash.slice(1)));if(target)target.scrollIntoView({block:'center'});}});<\/script></body></html>`;
  return injectBaseHref(snapshot, baseHref);
}

export function attachContentScrollHandler(
  scrollContainer: HTMLElement | null,
  onScroll: () => void,
): (() => void) | null {
  if (!scrollContainer) return null;
  scrollContainer.addEventListener('scroll', onScroll, { passive: true });
  return () => scrollContainer.removeEventListener('scroll', onScroll);
}

// Flush the throttled scroll buffer on hide/close even when React teardown
// does not run first (window minimize/close, tab foreground switch): the
// 400ms throttle holds the latest offset in the handler only, and the
// lifecycle hook flushes just the progress store.
export function attachScrollFlushOnHide(flush: () => void): () => void {
  const flushOnUnload = () => flush();
  const flushOnVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('beforeunload', flushOnUnload);
  document.addEventListener('visibilitychange', flushOnVisibilityChange);
  return () => {
    window.removeEventListener('beforeunload', flushOnUnload);
    document.removeEventListener('visibilitychange', flushOnVisibilityChange);
  };
}
