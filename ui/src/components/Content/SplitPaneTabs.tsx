import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { normalizePathKey } from '../../contexts/appStateModel';
import type { PaneId } from '../../split-view/paneState';
import { beginSplitPointerDrag } from '../../split-view/splitPointerDrag';
import { CloseIcon } from '../shared/icons';

export interface SplitPaneTabsProps {
  paneId: PaneId;
  paths: readonly string[];
  activePath: string | null;
  labels: ReadonlyMap<string, string>;
  dirtyMap?: ReadonlyMap<string, boolean>;
  closeLabel?: string;
  dirtyLabel?: string;
  onActivate?: (paneId: PaneId, filePath: string) => void;
  onClose?: (paneId: PaneId, filePath: string) => void;
  onOpenContextMenu?: (context: { paneId: PaneId; filePath: string; x: number; y: number }) => void;
}

export function SplitPaneTabs({
  paneId,
  paths,
  activePath,
  labels,
  dirtyMap,
  closeLabel = 'Close tab',
  dirtyLabel = 'Unsaved changes',
  onActivate,
  onClose,
  onOpenContextMenu,
}: SplitPaneTabsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, path: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate?.(paneId, path);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button === 1) event.preventDefault();
  };

  const handleAuxClick = (event: MouseEvent<HTMLDivElement>, path: string) => {
    if (event.button === 1) {
      event.preventDefault();
      onClose?.(paneId, path);
    }
  };

  const handleTabPointerDown = (event: PointerEvent<HTMLDivElement>, path: string, label: string) => {
    if ((event.target as HTMLElement).closest('button')) return;
    beginSplitPointerDrag(event, { kind: 'split-tab', sourcePaneId: paneId, filePath: path }, { label, source: event.currentTarget });
  };

  return (
    <div
      className="split-document-pane__tabs"
      role="tablist"
      aria-label={`${paneId} document tabs`}
    >
      {paths.map((path) => {
        const active = normalizePathKey(path) === normalizePathKey(activePath ?? '');
        const label = labels.get(normalizePathKey(path)) ?? path.split(/[\\/]/).pop() ?? path;
        const dirty = dirtyMap?.get(normalizePathKey(path)) ?? false;
        return (
          <div
            key={path}
            className={`content-tab split-document-pane__tab-wrap${active ? ' is-active' : ''}`}
            role="tab"
            aria-selected={active}
            aria-label={label}
            tabIndex={0}
            title={path}
            onPointerDown={(event) => handleTabPointerDown(event, path, label)}
            onClick={() => onActivate?.(paneId, path)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenContextMenu?.({ paneId, filePath: path, x: event.clientX, y: event.clientY });
            }}
            onKeyDown={(event) => handleKeyDown(event, path)}
            onMouseDown={handleMouseDown}
            onAuxClick={(event) => handleAuxClick(event, path)}
          >
            <span className="content-tab__label split-document-pane__tab">{label}</span>
            {dirty && (
              <span className="content-tab__dirty" aria-label={dirtyLabel} title={dirtyLabel}>
                ●
              </span>
            )}
            <button
              type="button"
              className="content-tab__close split-document-pane__tab-close"
              aria-label={`${closeLabel} ${label}`}
              title={`${closeLabel} ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose?.(paneId, path);
              }}
            >
              <CloseIcon size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
