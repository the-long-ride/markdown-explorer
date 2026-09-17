import type { MutableRefObject } from 'react';
import type { ContentTab } from '../../types';
import { CloseIcon } from '../shared/icons';

interface ContentTabItemProps {
  tab: ContentTab;
  active: boolean;
  label: string;
  closePhaseClass: string;
  dragged: boolean;
  closeLabel: string;
  dirty?: boolean;
  dirtyLabel?: string;
  draggedTabPathRef: MutableRefObject<string | null>;
  didDragRef: MutableRefObject<boolean>;
  ghostRef: React.RefObject<HTMLDivElement | null>;
  tabElementsRef: MutableRefObject<Map<string, HTMLDivElement>>;
  onSetDraggedPath: (path: string | null) => void;
  onSetGhostLabel: (label: string) => void;
  onReorder: (sourcePath: string, targetPath: string) => void;
  onActivate: (path: string) => void;
  onOpenContextMenu: (menu: { filePath: string; x: number; y: number }) => void;
  onClose: (path: string) => void;
}

export function ContentTabItem({
  tab, active, label, closePhaseClass, dragged, closeLabel, dirty = false,
  dirtyLabel = 'Unsaved changes', draggedTabPathRef, didDragRef, ghostRef,
  tabElementsRef, onSetDraggedPath, onSetGhostLabel, onReorder, onActivate,
  onOpenContextMenu, onClose,
}: ContentTabItemProps) {
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.content-tab__close')) return;
    draggedTabPathRef.current = tab.filePath;
    didDragRef.current = false;
    onSetDraggedPath(tab.filePath);
    onSetGhostLabel(label);
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!ghostRef.current) return;
      ghostRef.current.style.transform = `translate3d(${moveEvent.clientX + 10}px, ${moveEvent.clientY + 10}px, 0)`;
      ghostRef.current.style.display = 'flex';
    };
    const cleanUpMove = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', cleanUpMove);
      document.removeEventListener('pointercancel', cleanUpMove);
      if (ghostRef.current) ghostRef.current.style.display = 'none';
    };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', cleanUpMove);
    document.addEventListener('pointercancel', cleanUpMove);
  };

  return (
    <div
      ref={(element) => {
        if (element) {
          tabElementsRef.current.set(tab.filePath, element);
        } else {
          tabElementsRef.current.delete(tab.filePath);
        }
      }}
      className={`content-tab${active ? ' is-active' : ''}${dragged ? ' is-dragging' : ''}${closePhaseClass}`}
      role="tab" aria-selected={active} tabIndex={0} title={tab.relativePath}
      onPointerDown={startDrag}
      onPointerEnter={() => {
        if (draggedTabPathRef.current && draggedTabPathRef.current !== tab.filePath) {
          onReorder(draggedTabPathRef.current, tab.filePath);
          didDragRef.current = true;
        }
      }}
      onClick={(event) => {
        if (didDragRef.current) { event.preventDefault(); didDragRef.current = false; return; }
        onActivate(tab.filePath);
      }}
      onContextMenu={(event) => {
        event.preventDefault(); event.stopPropagation();
        onOpenContextMenu({ filePath: tab.filePath, x: event.clientX, y: event.clientY });
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); onActivate(tab.filePath);
      }}
      onMouseDown={(event) => { if (event.button === 1) event.preventDefault(); }}
      onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onClose(tab.filePath); } }}
    >
      <span className="content-tab__label">{label}</span>
      {dirty && <span className="content-tab__dirty" aria-label={dirtyLabel} title={dirtyLabel}>●</span>}
      <button type="button" className="content-tab__close" aria-label={closeLabel} title={closeLabel}
        onClick={(event) => { event.stopPropagation(); onClose(tab.filePath); }}>
        <CloseIcon size={11} />
      </button>
    </div>
  );
}
