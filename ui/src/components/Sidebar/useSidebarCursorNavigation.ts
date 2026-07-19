import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase());
}

export function useSidebarCursorNavigation({ cursorMode, currentFile, treeRef, filter, hideUnselected, scopeFocusEditing, selectedFilePaths, onCursorModeClose }: { cursorMode: boolean; currentFile?: string | null; treeRef: React.RefObject<HTMLDivElement | null>; filter: string; hideUnselected: boolean; scopeFocusEditing: boolean; selectedFilePaths: Set<string>; onCursorModeClose?: () => void }) {
  const [cursorItemId, setCursorItemId] = useState<string | null>(null);
  const getCursorItems = useCallback((): HTMLElement[] => treeRef.current ? Array.from(treeRef.current.querySelectorAll<HTMLElement>('[data-sidebar-cursor-item="true"]')) : [], [treeRef]);

  useLayoutEffect(() => {
    if (!cursorMode) { setCursorItemId(null); return; }
    const items = getCursorItems();
    if (!items.length) { setCursorItemId(null); return; }
    const currentItem = cursorItemId ? items.find((item) => item.dataset.sidebarId === cursorItemId) : null;
    const activeFileItem = currentFile ? items.find((item) => item.dataset.sidebarKind === 'file' && item.dataset.sidebarId === currentFile) : null;
    const nextItem = currentItem ?? activeFileItem ?? items[0];
    const nextId = nextItem.dataset.sidebarId ?? null;
    if (nextId !== cursorItemId) { setCursorItemId(nextId); return; }
    nextItem.focus({ preventScroll: true });
    nextItem.scrollIntoView({ block: 'nearest' });
  }, [cursorItemId, cursorMode, filter, getCursorItems, hideUnselected, scopeFocusEditing, selectedFilePaths, currentFile]);

  useEffect(() => {
    if (!cursorMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) { if (event.key === 'Escape') { event.preventDefault(); onCursorModeClose?.(); } return; }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCursorModeClose?.(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
      const items = getCursorItems();
      if (!items.length) return;
      event.preventDefault(); event.stopPropagation();
      let index = cursorItemId ? items.findIndex((item) => item.dataset.sidebarId === cursorItemId) : -1;
      if (index < 0) index = Math.max(0, items.findIndex((item) => item === document.activeElement));
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setCursorItemId(items[Math.min(items.length - 1, Math.max(0, index + direction))]?.dataset.sidebarId ?? null);
        return;
      }
      const currentItem = items[index] ?? items[0];
      if (!currentItem) return;
      currentItem.click();
      if (currentItem.dataset.sidebarKind === 'file') onCursorModeClose?.();
      else setCursorItemId(currentItem.dataset.sidebarId ?? null);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [cursorItemId, cursorMode, getCursorItems, onCursorModeClose]);

  useEffect(() => {
    if (!cursorMode) return;
    const handlePointerDown = (event: PointerEvent) => { if (event.target instanceof Node && treeRef.current?.contains(event.target)) return; onCursorModeClose?.(); };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [cursorMode, onCursorModeClose, treeRef]);

  return cursorItemId;
}
