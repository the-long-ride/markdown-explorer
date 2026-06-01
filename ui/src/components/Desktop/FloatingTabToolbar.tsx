import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FALLBACK_FLOATING_TOOLBAR_SIZE, FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY } from '../../desktop/constants';
import { clampFloatingToolbarPosition } from '../../desktop/desktopTabs';
import type { FloatingToolbarPosition, FloatingToolbarSize } from '../../desktop/types';
import { TooltipButton } from '../shared/TooltipButton';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CollapseIcon,
  CopyIcon,
  EditIcon,
  ExpandIcon,
  RefreshIcon,
  SearchIcon,
} from '../shared/icons';

interface FloatingTabToolbarProps {
  position: FloatingToolbarPosition;
  onPositionChange: (position: FloatingToolbarPosition) => void;
  onSearchOpen: () => void;
  searchShortcutLabel: string;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onEdit: () => void;
  onCopyFile: (button?: HTMLElement | null) => void;
  onRefresh: () => void;
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  canEdit: boolean;
}

export function FloatingTabToolbar({
  position,
  onPositionChange,
  onSearchOpen,
  searchShortcutLabel,
  onExpandAll,
  onCollapseAll,
  onEdit,
  onCopyFile,
  onRefresh,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  canEdit,
}: FloatingTabToolbarProps) {
  const [actionsCollapsed, setActionsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const measureToolbar = useCallback((): FloatingToolbarSize => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : FALLBACK_FLOATING_TOOLBAR_SIZE;
  }, []);

  const clampToViewport = useCallback(
    (nextPosition: FloatingToolbarPosition) => clampFloatingToolbarPosition(nextPosition, measureToolbar()),
    [measureToolbar],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('.tab-floating-toolbar__move')) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    try {
      localStorage.setItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY, String(actionsCollapsed));
    } catch {
      // Toolbar still works for current session.
    }
  }, [actionsCollapsed]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    onPositionChange(clampToViewport({
      x: drag.originX - (event.clientX - drag.startX),
      y: drag.originY - (event.clientY - drag.startY),
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  useLayoutEffect(() => {
    const next = clampToViewport(position);
    if (next.x !== position.x || next.y !== position.y) onPositionChange(next);
  }, [actionsCollapsed, clampToViewport, onPositionChange, position]);

  useEffect(() => {
    const handleResize = () => {
      const next = clampToViewport(position);
      if (next.x !== position.x || next.y !== position.y) onPositionChange(next);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampToViewport, onPositionChange, position]);

  return (
    <div
      ref={toolbarRef}
      className={`tab-floating-toolbar${actionsCollapsed ? ' is-actions-collapsed' : ''}`}
      style={{ right: position.x, bottom: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <button type="button" className="tab-floating-toolbar__move tooltip-container" aria-label="Move toolbar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="9" cy="6" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="18" r="1" />
        </svg>
        <span className="tooltip-text">Move toolbar</span>
      </button>
      <button type="button" className="tab-floating-toolbar__search" onClick={onSearchOpen} aria-label="Search current workspace">
        <SearchIcon size={14} />
        <span>Search docs... ({searchShortcutLabel})</span>
      </button>
      <div className="tab-floating-toolbar__actions" aria-hidden={actionsCollapsed}>
        <TooltipButton className="btn btn--icon" onClick={onBack} disabled={!canGoBack} tooltip="Back" icon={<ChevronLeftIcon />} />
        <TooltipButton className="btn btn--icon" onClick={onForward} disabled={!canGoForward} tooltip="Forward" icon={<ChevronRightIcon />} />
        <TooltipButton className="btn btn--icon" onClick={onRefresh} tooltip="Refresh tab" icon={<RefreshIcon />} />
        <TooltipButton className="btn btn--icon" onClick={onExpandAll} tooltip="Expand all" icon={<ExpandIcon />} />
        <TooltipButton className="btn btn--icon" onClick={onCollapseAll} tooltip="Collapse all" icon={<CollapseIcon />} />
        <TooltipButton className="btn" onClick={onEdit} disabled={!canEdit} tooltip="Open current file in editor" icon={<EditIcon />} label="Edit" onlyIcon={false} />
        <TooltipButton className="btn btn--icon" onClick={(event) => onCopyFile(event.currentTarget)} disabled={!canEdit} tooltip="Copy file content" icon={<CopyIcon />} />
      </div>
      <TooltipButton
        className="btn btn--icon tab-floating-toolbar__toggle"
        onClick={() => setActionsCollapsed((value) => !value)}
        tooltip={actionsCollapsed ? 'Show toolbar actions' : 'Minimize toolbar actions'}
        icon={actionsCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      />
    </div>
  );
}
