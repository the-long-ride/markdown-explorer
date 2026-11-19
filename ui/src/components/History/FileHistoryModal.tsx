import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFileHistoryTranslations } from '../../contexts/fileHistoryTranslations';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import type { HistoryClient } from '../../history/historyClient';
import { useFileHistory, type FileHistorySelection } from '../../history/useFileHistory';
import type { PlatformBridge } from '../../platform/bridge';
import type { PersistedState } from '../../types';
import { useCssVars } from '../../utils/useCssVars';
import '../../styles/global/global-history-diff.css';
import '../../styles/global/global-file-history-modal.css';
import { FileHistoryCommitList } from './FileHistoryCommitList';
import { FileHistoryDiffPane, FileHistoryViewControls, type FileHistoryView } from './FileHistoryDiffPane';
import { FileHistoryResizeHandle } from './FileHistoryResizeHandle';
import { HistoryCloseIcon, HistoryCompareIcon } from './HistoryActionIcons';
import { LIST_WIDTH, useFileHistoryLayout } from './useFileHistoryLayout';

interface FileHistoryModalProps {
  readonly filePath: string;
  readonly client: HistoryClient;
  readonly language?: string;
  readonly workspacePath?: string;
  readonly bridge: PlatformBridge;
  currentSource(): string | null;
  onClose(): void;
}

const VIEWS: readonly FileHistoryView[] = ['raw-inline', 'raw-split', 'rendered'];
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function readView(bridge: PlatformBridge): FileHistoryView {
  const stored = bridge.getState<PersistedState>()?.fileHistoryView;
  return stored && VIEWS.includes(stored) ? stored : 'raw-inline';
}

function anchorOid(selection: FileHistorySelection | null): string | null {
  if (!selection) return null;
  return selection.kind === 'range' ? selection.newerOid : selection.oid;
}

export type CompareReplaceSide = 'older' | 'newer';

/**
 * Updates the two-commit compare selection using Option 3 boundary movement:
 * clicks outside the checked span move the adjacent outer boundary, while clicks
 * between the two checked commits alternate moving the older then newer endpoint.
 */
export function nextComparePicks(
  entries: readonly { readonly oid: string }[],
  picks: readonly string[],
  oid: string,
  insideReplaceSide: CompareReplaceSide,
): { readonly picks: string[]; readonly nextInsideSide: CompareReplaceSide } {
  if (picks.includes(oid)) {
    const remaining = picks.filter((value) => value !== oid);
    return {
      picks: remaining,
      nextInsideSide: remaining.length < 2 ? 'older' : insideReplaceSide,
    };
  }
  if (picks.length < 2) {
    return { picks: [...picks, oid], nextInsideSide: 'older' };
  }

  const indexOf = (value: string) => entries.findIndex((item) => item.oid === value);
  const idxA = indexOf(picks[0]);
  const idxB = indexOf(picks[1]);
  const targetIdx = indexOf(oid);
  if (idxA < 0 || idxB < 0 || targetIdx < 0) {
    const older = idxA > idxB ? picks[0] : picks[1];
    return { picks: [...picks.filter((value) => value !== older), oid], nextInsideSide: 'older' };
  }

  const newerPick = idxA <= idxB ? picks[0] : picks[1];
  const olderPick = idxA <= idxB ? picks[1] : picks[0];
  const newerIdx = Math.min(idxA, idxB);
  const olderIdx = Math.max(idxA, idxB);

  // Entries are ordered newest (0) -> oldest (length - 1).
  if (targetIdx < newerIdx) {
    return { picks: [oid, olderPick], nextInsideSide: insideReplaceSide };
  }
  if (targetIdx > olderIdx) {
    return { picks: [newerPick, oid], nextInsideSide: insideReplaceSide };
  }
  if (insideReplaceSide === 'older') {
    return { picks: [newerPick, oid], nextInsideSide: 'newer' };
  }
  return { picks: [oid, olderPick], nextInsideSide: 'older' };
}

export function FileHistoryModal({ filePath, client, language, workspacePath, bridge, currentSource, onClose }: FileHistoryModalProps) {
  const t = getFileHistoryTranslations(language);
  const historyT = getHistoryTranslations(language);
  const history = useFileHistory(client, filePath, currentSource, workspacePath);
  const { entries, selection, select } = history;
  const [view, setView] = useState<FileHistoryView>(() => readView(bridge));
  const [compareMode, setCompareMode] = useState(false);
  const [picks, setPicks] = useState<readonly string[]>([]);
  const insideReplaceSideRef = useRef<CompareReplaceSide>('older');
  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { layout, updateLayout } = useFileHistoryLayout(bridge);
  const layoutVars = useMemo(() => ({
    '--file-history-list-width': `${layout.listWidth}px`,
    '--file-history-split-ratio': layout.splitRatio,
  }), [layout.listWidth, layout.splitRatio]);
  useCssVars(cardRef, layoutVars);
  const showViewControls = history.status !== 'error' && history.status !== 'loading' && entries.length > 0;

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  const changeView = useCallback((next: FileHistoryView) => {
    setView(next);
    const state = bridge.getState<PersistedState>() ?? {};
    bridge.setState<PersistedState>({ ...state, fileHistoryView: next });
  }, [bridge]);

  const togglePick = useCallback((oid: string) => {
    const { picks: next, nextInsideSide } = nextComparePicks(entries, picks, oid, insideReplaceSideRef.current);
    insideReplaceSideRef.current = nextInsideSide;
    setPicks(next);
    if (next.length === 2) {
      const indexOf = (value: string) => entries.findIndex((item) => item.oid === value);
      const [a, b] = next;
      const aIsOlder = indexOf(a) > indexOf(b);
      select({ kind: 'range', olderOid: aIsOlder ? a : b, newerOid: aIsOlder ? b : a });
    }
  }, [entries, picks, select]);

  const selectCurrent = useCallback(() => {
    const oid = anchorOid(selection) ?? entries[0]?.oid;
    if (oid) select({ kind: 'current', oid });
  }, [entries, select, selection]);

  const errorMessage = (reason: string | null) => {
    if (reason === 'unsupported-runtime') return historyT.unsupportedRuntime;
    if (reason === 'git-unavailable') return historyT.gitUnavailable;
    if (reason === 'not-repository') return historyT.notRepository;
    if (reason === 'History request timed out') return t.timeout;
    return reason || historyT.historyUnavailable;
  };

  return (
    <div ref={dialogRef} className="mdn-modal mdn-app-modal-region file-history-modal" role="dialog" aria-modal="true" aria-label={`${t.title} — ${fileName}`} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={cardRef} className="file-history__card">
        <header className="file-history__header">
          <div className="file-history__heading"><h2>{t.title}</h2><p data-hover-tooltip={filePath}>{filePath}</p></div>
          {showViewControls && <FileHistoryViewControls view={view} t={t} fileAdded={history.diff.fileAdded} onViewChange={changeView} />}
          <button
            type="button"
            className={`btn file-history__compare${compareMode ? ' is-active' : ''}`}
            aria-pressed={compareMode}
            onClick={() => { setCompareMode((value) => !value); setPicks([]); insideReplaceSideRef.current = 'older'; }}
            disabled={entries.length < 2}
          ><HistoryCompareIcon size={14} /> {t.compare}</button>
          <button ref={closeRef} type="button" className="file-history__close" aria-label={t.close} onClick={onClose}><HistoryCloseIcon size={16} /></button>
        </header>
        {history.status === 'error' ? (
          <div className="file-history__status file-history__status--error" role="status">
            <span>{errorMessage(history.error)}</span>
            <button type="button" className="btn" onClick={history.retry}>{historyT.retry}</button>
          </div>
        ) : history.status === 'loading' ? (
          <div className="file-history__body file-history__body--loading" aria-busy="true">
            <div className="file-history__skeleton-list">{Array.from({ length: 8 }, (_, index) => <span key={index} className="file-history__skeleton-row" />)}</div>
            <div className="file-history__skeleton-diff" />
          </div>
        ) : entries.length === 0 ? (
          <div className="file-history__status" role="status">{t.noFileHistory}</div>
        ) : (
          <div className="file-history__body">
            <div ref={sidebarRef} className="file-history__sidebar">
              <FileHistoryCommitList
                entries={entries}
                selection={selection}
                compareMode={compareMode}
                picks={picks}
                hasMore={history.hasMore}
                language={language}
                t={t}
                onSelectCommit={(oid) => select({ kind: 'commit', oid })}
                onTogglePick={togglePick}
                onSelectCurrent={selectCurrent}
                onLoadMore={() => { void history.loadMore(); }}
                hint={compareMode ? t.compareHint : null}
              />
              <FileHistoryResizeHandle
                className="file-history__resizer--list"
                label={t.resizeList}
                valueNow={layout.listWidth}
                valueMin={LIST_WIDTH.min}
                valueMax={LIST_WIDTH.max}
                onResize={(clientX) => {
                  const left = sidebarRef.current?.getBoundingClientRect().left;
                  if (left !== undefined) updateLayout({ listWidth: clientX - left });
                }}
                onStep={(steps) => updateLayout({ listWidth: layout.listWidth + steps * LIST_WIDTH.step })}
                onReset={() => updateLayout({ listWidth: LIST_WIDTH.initial })}
              />
            </div>
            <FileHistoryDiffPane
              diff={history.diff}
              view={view}
              language={language}
              t={t}
              currentLabel={t.currentFile}
              splitRatio={layout.splitRatio}
              onSplitRatioChange={(splitRatio) => updateLayout({ splitRatio })}
            />
          </div>
        )}
      </section>
    </div>
  );
}
