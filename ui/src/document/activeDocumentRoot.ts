// Registry of mounted document surfaces (main view or split panes). Global
// commands (find in page, search/bookmark jump, TOC, copy document) resolve
// their target through the active entry instead of a fixed `#mdBody` id.
export type DocumentRootId = 'main' | 'primary' | 'secondary';

export interface DocumentRootEntry {
  readonly id: DocumentRootId;
  readonly body: HTMLElement;
  readonly scroll: HTMLElement | null;
  readonly filePath: string | null;
  readonly markdownSource: string | null;
}

const roots = new Map<DocumentRootId, DocumentRootEntry>();
let activeId: DocumentRootId = 'main';

export function registerDocumentRoot(entry: DocumentRootEntry): () => void {
  roots.set(entry.id, entry);
  return () => {
    if (roots.get(entry.id) === entry) roots.delete(entry.id);
  };
}

export function setActiveDocumentRootId(id: DocumentRootId): void {
  activeId = id;
}

export function getDocumentRoot(id: DocumentRootId): DocumentRootEntry | null {
  return roots.get(id) ?? null;
}

export function getActiveDocumentRoot(): DocumentRootEntry | null {
  return roots.get(activeId) ?? roots.get('main') ?? roots.values().next().value ?? null;
}

export function getActiveDocumentBody(): HTMLElement | null {
  return getActiveDocumentRoot()?.body ?? document.getElementById('mdBody');
}

export function getActiveDocumentScroll(): HTMLElement | null {
  const entry = getActiveDocumentRoot();
  if (entry) return entry.scroll;
  return document.getElementById('contentScroll');
}

export function findDocumentRootFor(element: Element | null): DocumentRootEntry | null {
  if (!element) return null;
  for (const entry of roots.values()) {
    if (entry.body === element || entry.body.contains(element)) return entry;
  }
  return null;
}

export function resetDocumentRoots(): void {
  roots.clear();
  activeId = 'main';
}
