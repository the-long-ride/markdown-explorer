import { memo, useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { normalizePathKey } from '../../contexts/appStateModel';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import type { HistoryViewEntry, HistoryViewTarget } from '../../contexts/HistoryContext';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import { getTranslations } from '../../contexts/translations';
import type { PaneDocumentProjection } from '../../split-view/paneSelectors';
import type { DocumentViewMode, PaneId } from '../../split-view/paneState';
import { beginSplitPointerDrag } from '../../split-view/splitPointerDrag';
import { DocumentDiffView } from '../History/DocumentDiffView';
import { GitRevisionView } from '../History/GitRevisionView';
import { HistoryCompareIcon } from '../History/HistoryActionIcons';
import { EditIcon, HistoryIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { PlainSourceIcon, RenderedViewIcon } from './MarkdownEditingIcons';
import { ENHANCEMENTS_SETTLED_EVENT } from './scheduleContentEnhancements';
import { SplitPaneDocument } from './SplitPaneDocument';
import { SplitPaneTabs } from './SplitPaneTabs';

export interface PaneViewProps {
  paneId: PaneId;
  projection: PaneDocumentProjection | null;
  paneTabs: readonly string[];
  activeTabPath: string | null;
  tabLabels: ReadonlyMap<string, string>;
  dirtyMap?: ReadonlyMap<string, boolean>;
  showTabs: boolean;
  historyView?: HistoryViewEntry;
  language: string;
  documentRenderRevision: number;
  editingEnabled: boolean;
  clearHistoryView: (target?: HistoryViewTarget) => void;
  onModeChange: (paneId: PaneId, mode: DocumentViewMode) => void;
  onSourceChange: (filePath: string, source: string) => void;
  onSave: (filePath: string) => void | Promise<unknown>;
  onScrollChange: (paneId: PaneId, scrollTop: number) => void;
  onTabActivate?: (paneId: PaneId, filePath: string) => void;
  onTabClose?: (paneId: PaneId, filePath: string) => void;
  onTabContextMenu?: (context: { paneId: PaneId; filePath: string; x: number; y: number }) => void;
  onHeaderContextMenu?: (context: { paneId: PaneId; x: number; y: number }) => void;
}

const EDITABLE_MODES = ['inline-edit', 'plain'] as const satisfies readonly DocumentViewMode[];
const READ_ONLY_MODES = [] as const satisfies readonly DocumentViewMode[];
const SCROLL_PERSIST_DELAY_MS = 180;
const RESTORE_CANCEL_EVENTS = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const;

function sameHistoryView(left?: HistoryViewEntry, right?: HistoryViewEntry): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.filePath === right.filePath
    && left.mode === right.mode
    && left.revision === right.revision
    && left.comparison === right.comparison;
}

function sameValue(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function samePaneProjection(left: PaneDocumentProjection | null, right: PaneDocumentProjection | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (
    left.filePath !== right.filePath
    || left.relativePath !== right.relativePath
    || left.fileName !== right.fileName
    || left.title !== right.title
    || left.mode !== right.mode
    || left.session?.saveState !== right.session?.saveState
    || !sameValue(left.frontmatter, right.frontmatter)
    || !sameValue(left.toc, right.toc)
    || !sameValue(left.previewInfo, right.previewInfo)
    || left.htmlPreviewOverride !== right.htmlPreviewOverride
    || left.stale !== right.stale
  ) return false;

  if (left.mode === 'plain' || left.mode === 'inline-edit') {
    return left.source === right.source;
  }
  return true;
}

function samePaths(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((path, index) => path === right[index]);
}

function sameTabLabels(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
  paths: readonly string[],
): boolean {
  if (left === right) return true;
  for (const path of paths) {
    const key = normalizePathKey(path);
    if (left.get(key) !== right.get(key)) return false;
  }
  return true;
}

function sameDirtyMap(
  left?: ReadonlyMap<string, boolean>,
  right?: ReadonlyMap<string, boolean>,
  paths: readonly string[] = [],
): boolean {
  if (left === right) return true;
  for (const path of paths) {
    const key = normalizePathKey(path);
    if (Boolean(left?.get(key)) !== Boolean(right?.get(key))) return false;
  }
  return true;
}

function panePropsEqual(left: PaneViewProps, right: PaneViewProps): boolean {
  return left.paneId === right.paneId
    && left.language === right.language
    && left.editingEnabled === right.editingEnabled
    && left.documentRenderRevision === right.documentRenderRevision
    && left.activeTabPath === right.activeTabPath
    && left.showTabs === right.showTabs
    && samePaths(left.paneTabs, right.paneTabs)
    && sameTabLabels(left.tabLabels, right.tabLabels, right.paneTabs)
    && sameDirtyMap(left.dirtyMap, right.dirtyMap, right.paneTabs)
    && samePaneProjection(left.projection, right.projection)
    && sameHistoryView(left.historyView, right.historyView);
}

function SplitPaneViewImpl({
  paneId,
  projection,
  paneTabs,
  activeTabPath,
  tabLabels,
  dirtyMap,
  showTabs,
  historyView,
  language,
  documentRenderRevision,
  editingEnabled,
  clearHistoryView,
  onModeChange,
  onSourceChange,
  onSave,
  onScrollChange,
  onTabActivate,
  onTabClose,
  onTabContextMenu,
  onHeaderContextMenu,
}: PaneViewProps): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(projection?.scrollTop ?? 0);
  const scrollTimerRef = useRef<number | null>(null);
  const pendingRestoreRef = useRef<number | null>(null);
  const t = getTranslations(language);
  const editorT = getEditorUiTranslations(language);
  const historyT = getHistoryTranslations(language);
  const splitT = getSplitViewTranslations(language);
  const paneLabel = paneId === 'primary' ? splitT.primaryDocument : splitT.secondaryDocument;

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !projection) return;
    scrollTopRef.current = projection.scrollTop;
    pendingRestoreRef.current = projection.scrollTop > 0 ? projection.scrollTop : null;
    if (node.scrollTop !== projection.scrollTop) node.scrollTop = projection.scrollTop;
  }, [projection?.filePath, projection?.mode]);

  // Mermaid, tables and code highlighting change the document height after the
  // first restore; re-apply the stored position each time they settle, until
  // the user scrolls on their own.
  const hasProjection = Boolean(projection);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const cancelRestore = () => { pendingRestoreRef.current = null; };
    const reapply = () => {
      const target = pendingRestoreRef.current;
      if (target !== null && node.scrollTop !== target) node.scrollTop = target;
    };
    RESTORE_CANCEL_EVENTS.forEach((type) => node.addEventListener(type, cancelRestore, { passive: true }));
    node.addEventListener(ENHANCEMENTS_SETTLED_EVENT, reapply);
    return () => {
      RESTORE_CANCEL_EVENTS.forEach((type) => node.removeEventListener(type, cancelRestore));
      node.removeEventListener(ENHANCEMENTS_SETTLED_EVENT, reapply);
    };
  }, [hasProjection]);

  useEffect(() => () => {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
  }, []);

  const handleScroll = (node: HTMLDivElement) => {
    scrollTopRef.current = node.scrollTop;
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      scrollTimerRef.current = null;
      onScrollChange(paneId, scrollTopRef.current);
    }, SCROLL_PERSIST_DELAY_MS);
  };

  const handleHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('.content-tab, button, input, a, select')) return;
    const label = projection?.title || projection?.fileName || paneLabel;
    beginSplitPointerDrag(event, { kind: 'split-header', paneId }, { label, source: event.currentTarget.closest<HTMLElement>('.split-document-pane') });
  };

  if (!projection) {
    return (
      <div className="split-document-pane__empty">
        {splitT.noDocument}
      </div>
    );
  }

  const modeLabels: Record<DocumentViewMode, string> = {
    rendered: editorT.rendered,
    'inline-edit': editorT.inlineEdit,
    plain: editorT.plain,
    'git-revision': historyT.revision,
    diff: historyT.diff,
  };
  const modeIcons: Record<DocumentViewMode, ReactNode> = {
    rendered: <RenderedViewIcon size={14} />,
    'inline-edit': <EditIcon size={13} />,
    plain: <PlainSourceIcon size={14} />,
    'git-revision': <HistoryIcon size={14} />,
    diff: <HistoryCompareIcon size={14} />,
  };
  const isMarkdownDocument = /\.mdx?$/i.test(projection.fileName);
  const historyMode = historyView?.mode;
  const baseModes: readonly DocumentViewMode[] = editingEnabled ? EDITABLE_MODES : READ_ONLY_MODES;
  const modes: readonly DocumentViewMode[] = historyMode && projection.mode === historyMode
    ? ['rendered', historyMode]
    : historyMode
      ? [...baseModes, historyMode]
      : projection.mode === 'rendered'
        ? baseModes
        : ['rendered', ...baseModes];
  const surfaceMode: DocumentViewMode = !editingEnabled && (projection.mode === 'inline-edit' || projection.mode === 'plain')
    ? 'rendered'
    : projection.mode === 'git-revision' || projection.mode === 'diff' ? 'rendered' : projection.mode;

  return (
    <div className="split-document-pane__content">
      <header
        className="split-document-pane__header"
        onPointerDown={handleHeaderPointerDown}
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest('.content-tab, button, input')) return;
          event.preventDefault();
          onHeaderContextMenu?.({ paneId, x: event.clientX, y: event.clientY });
        }}
      >
        {showTabs ? (
          <SplitPaneTabs
            paneId={paneId}
            paths={paneTabs}
            activePath={activeTabPath}
            labels={tabLabels}
            dirtyMap={dirtyMap}
            closeLabel={t.tooltips.closeTab}
            dirtyLabel={editorT.unsavedChanges}
            onActivate={onTabActivate}
            onClose={onTabClose}
            onOpenContextMenu={onTabContextMenu}
          />
        ) : (
          <span className="split-document-pane__title" title={projection.filePath}>{projection.title || projection.fileName}</span>
        )}
        {isMarkdownDocument && modes.length > 0 && (
          <div className="split-document-pane__modes" role="group" aria-label={`${paneLabel}: ${editorT.modeGroup}`}>
            {modes.map((mode) => (
              <TooltipButton
                key={mode}
                type="button"
                className={`split-document-pane__mode${projection.mode === mode ? ' is-active' : ''}`}
                aria-label={`${paneLabel} ${modeLabels[mode]}`}
                aria-pressed={projection.mode === mode}
                tooltip={modeLabels[mode]}
                portalTooltip
                icon={modeIcons[mode]}
                onClick={() => {
                  if (mode === 'rendered' && projection.mode !== 'rendered' && historyView) clearHistoryView(paneId);
                  else onModeChange(paneId, mode);
                }}
              />
            ))}
          </div>
        )}
      </header>
      <div
        ref={scrollRef}
        className="split-document-pane__scroll"
        data-testid={`split-pane-scroll-${paneId}`}
        onScroll={(event) => handleScroll(event.currentTarget)}
      >
        {projection.mode === 'git-revision' && historyView?.revision
          ? <GitRevisionView snapshot={historyView.revision} language={language} onReturnToCurrent={() => clearHistoryView(paneId)} />
          : projection.mode === 'diff' && historyView?.comparison
            ? <DocumentDiffView {...historyView.comparison} language={language} onReturnToCurrent={() => clearHistoryView(paneId)} />
            : <SplitPaneDocument paneId={paneId} projection={projection} mode={surfaceMode} renderVersion={documentRenderRevision} disabled={!editingEnabled || projection.session?.saveState === 'saving'} language={language} scrollRef={scrollRef} onSourceChange={(source) => onSourceChange(projection.filePath, source)} onSave={() => onSave(projection.filePath)} onModeChange={(mode) => onModeChange(paneId, mode)} />}
      </div>
    </div>
  );
}

export const SplitPaneView = memo(SplitPaneViewImpl, panePropsEqual);
