import { useCallback, useEffect, useState } from 'react';
import { captureDomBookmarkTarget } from '../../bookmarks/bookmarkDomAnchors.ts';
import type { BookmarkSelectionState } from '../Bookmarks/BookmarkSelectionMenu';

interface BookmarkSelectionArgs {
  enabled: boolean;
  currentFile: string | null;
  renderVersion: number;
  isFullHtmlPreview: boolean;
  markdownSource: string | null;
  sourceDocumentText: string | null;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  closeLinkMenu: () => void;
}

export function useBookmarkSelection({
  enabled,
  currentFile,
  renderVersion,
  isFullHtmlPreview,
  markdownSource,
  sourceDocumentText,
  bodyRef,
  closeLinkMenu,
}: BookmarkSelectionArgs) {
  const [selectionState, setSelectionState] = useState<BookmarkSelectionState | null>(null);
  useEffect(() => setSelectionState(null), [currentFile, renderVersion]);

  const openCapture = useCallback((
    target: Range | Element,
    x: number,
    y: number,
    presentation: BookmarkSelectionState['presentation'] = 'menu',
  ): boolean => {
    if (!enabled || !currentFile || isFullHtmlPreview) return false;
    const body = bodyRef.current;
    const documentText = markdownSource ?? sourceDocumentText;
    if (!body || documentText === null) return false;
    const capture = captureDomBookmarkTarget(body, target, documentText);
    if (!capture) return false;
    closeLinkMenu();
    setSelectionState({ x, y, documentText, ...capture, presentation });
    return true;
  }, [bodyRef, closeLinkMenu, currentFile, enabled, isFullHtmlPreview, markdownSource, sourceDocumentText]);

  const openBookmarkDialogForElement = useCallback((
    element: Element,
    x: number,
    y: number,
  ) => openCapture(element, x, y, 'dialog'), [openCapture]);

  const handleContextMenu = useCallback((event: MouseEvent): boolean => {
    if (!enabled || !currentFile || isFullHtmlPreview) return false;
    const body = bodyRef.current;
    if (!body) return false;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const targetNode = event.target instanceof Element ? event.target : null;
      if (body.contains(range.commonAncestorContainer) && (!targetNode || selection.containsNode(targetNode, true))) {
        const rect = range.getBoundingClientRect();
        if (openCapture(range, event.clientX || rect.left + rect.width / 2, event.clientY || rect.top + rect.height / 2)) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }
    }
    if (!(event.target instanceof Element)) return false;
    const object = event.target.closest('[data-mdn-bookmark-kind="math"], [data-mdn-bookmark-kind="code"]');
    if (object && body.contains(object) && openCapture(object, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  }, [bodyRef, currentFile, enabled, isFullHtmlPreview, openCapture]);

  return {
    bookmarkSelection: selectionState,
    closeBookmarkSelection: () => setSelectionState(null),
    handleBookmarkContextMenu: handleContextMenu,
    openBookmarkDialogForElement,
  };
}
