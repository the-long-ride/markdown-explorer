import type { DocumentRootId } from './activeDocumentRoot';

// Table and HTML-preview ids come from shortId() (`tbl_xxxxxx`, `html_xxxxxx`) and
// are shared when the same rendered HTML is mounted in both split panes. The
// global Table.* handlers resolve by id, so the secondary pane gets a suffix.
const RENDERED_ID_PATTERN = /\b((?:tbl|html)_[a-z0-9]{6})(?![a-z0-9_])/g;

export function scopeDocumentIds(html: string, rootId: DocumentRootId): string {
  if (rootId !== 'secondary' || !html) return html;
  return html.replace(RENDERED_ID_PATTERN, '$1_s');
}
