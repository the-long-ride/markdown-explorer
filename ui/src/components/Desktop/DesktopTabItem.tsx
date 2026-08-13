import type { MutableRefObject } from 'react';
import { getTabLabel } from '../../desktop/desktopTabs';
import type { DesktopTab } from '../../desktop/types';
import { CloseIcon } from '../shared/icons';

interface DesktopTabItemProps {
  tab: DesktopTab;
  active: boolean;
  editing: boolean;
  dragged: boolean;
  closePhaseClass: string;
  draftAlias: string;
  closeLabel: string;
  draggedTabIdRef: MutableRefObject<string | null>;
  didDragRef: MutableRefObject<boolean>;
  ghostRef: React.RefObject<HTMLDivElement | null>;
  tabElementsRef: MutableRefObject<Map<string, HTMLButtonElement>>;
  onDraftAliasChange: (alias: string) => void;
  onCommitAlias: () => void;
  onCancelAlias: () => void;
  onStartEditing: (tab: DesktopTab) => void;
  onSetDraggedTabId: (tabId: string | null) => void;
  onSetGhostLabel: (label: string) => void;
  onReorder: (sourceTabId: string, targetTabId: string) => void;
  onSelect: (tabId: string) => void;
  onContextMenu: (menu: { tabId: string; x: number; y: number }) => void;
  onClose: (tabId: string) => void;
}

export function DesktopTabItem({
  tab, active, editing, dragged, closePhaseClass, draftAlias, closeLabel,
  draggedTabIdRef, didDragRef, ghostRef, tabElementsRef, onDraftAliasChange,
  onCommitAlias, onCancelAlias, onStartEditing, onSetDraggedTabId,
  onSetGhostLabel, onReorder, onSelect, onContextMenu, onClose,
}: DesktopTabItemProps) {
  const label = getTabLabel(tab);
  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (editing || event.button !== 0 || (event.target as HTMLElement).closest('.desktop-tab__close')) return;
    draggedTabIdRef.current = tab.id;
    didDragRef.current = false;
    onSetDraggedTabId(tab.id);
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
    <button
      ref={(element) => {
        if (element) {
          tabElementsRef.current.set(tab.id, element);
        } else {
          tabElementsRef.current.delete(tab.id);
        }
      }}
      type="button" role="tab" aria-selected={active}
      className={`desktop-tab${active ? ' is-active' : ''}${dragged ? ' is-dragging' : ''}${closePhaseClass}`}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu({ tabId: tab.id, x: event.clientX, y: event.clientY }); }}
      onMouseDown={(event) => { if (event.button === 1) event.preventDefault(); }}
      onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); event.stopPropagation(); onClose(tab.id); } }}
      onDoubleClick={() => onStartEditing(tab)} title={tab.workspacePath ?? label}
      onPointerDown={beginDrag}
      onPointerEnter={() => {
        if (draggedTabIdRef.current && draggedTabIdRef.current !== tab.id) {
          onReorder(draggedTabIdRef.current, tab.id);
          didDragRef.current = true;
        }
      }}
      onClick={(event) => {
        if (didDragRef.current) { event.preventDefault(); didDragRef.current = false; return; }
        onSelect(tab.id);
      }}
    >
      {editing ? (
        <input className="desktop-tab__alias-input" value={draftAlias} autoFocus
          onChange={(event) => onDraftAliasChange(event.target.value)}
          onClick={(event) => event.stopPropagation()} onBlur={onCommitAlias}
          onKeyDown={(event) => { if (event.key === 'Enter') onCommitAlias(); if (event.key === 'Escape') onCancelAlias(); }} />
      ) : <span className="desktop-tab__label">{label}</span>}
      <span className="desktop-tab__close" role="button" tabIndex={-1} aria-label={closeLabel} title={closeLabel}
        onClick={(event) => { event.stopPropagation(); onClose(tab.id); }}>
        <CloseIcon size={11} />
      </span>
    </button>
  );
}
