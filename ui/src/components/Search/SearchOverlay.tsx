// =============================================================================
// components/Search/SearchOverlay.tsx — Scoped search modal
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CROSS_TAB_RESULT_PAGE_SIZE } from '../../constants/limits';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { getTranslations } from '../../contexts/translations';
import type { WorkspaceSearchResult } from '../../types';
import { ChevronRightIcon, CloseIcon, SearchIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { useCssVars } from '../../utils/useCssVars';
import { SearchDocumentPreview } from './SearchDocumentPreview';
import { SearchOverlayResults } from './SearchOverlayResults';
import { SearchOverlayWorkspaceList } from './SearchOverlayWorkspaceList';
import {
  buildCurrentTabResults,
  buildWorkspaceChoices,
  isCrossTabItem,
  resultKey,
  toWorkspaceSearchResult,
  type CrossTabSearchItem,
  type SearchResultItem,
  type WorkspaceChoice,
} from './searchOverlayModel';
import { useSearchOverlayResize } from './useSearchOverlayResize';

export { renderHighlightedExcerpt } from './searchOverlayModel';
export type { CrossTabSearchItem } from './searchOverlayModel';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  scopeKey?: string;
  scopeLabel?: string;
  crossTabItems?: readonly CrossTabSearchItem[];
  onWorkspaceSelect?: (item: WorkspaceSearchResult, query: string, matchCase: boolean) => void;
  onCrossTabSelect?: (item: CrossTabSearchItem, query: string, matchCase: boolean) => void;
  isIndexing?: boolean;
}

let persistentSearchPreviewEnabled = true;

export function SearchOverlay({
  isOpen,
  onClose,
  scopeKey,
  scopeLabel,
  crossTabItems,
  onWorkspaceSelect,
  onCrossTabSelect,
  isIndexing,
}: SearchOverlayProps) {
  const { state, navigate } = useAppState();
  const bridge = usePlatform();
  const t = getTranslations(state.settings.language || 'en');
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [previewEnabled, setPreviewEnabledState] = useState(persistentSearchPreviewEnabled);

  const setPreviewEnabled = useCallback((action: boolean | ((prev: boolean) => boolean)) => {
    setPreviewEnabledState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      persistentSearchPreviewEnabled = next;
      return next;
    });
  }, []);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('all');
  const [checkedWorkspaceIds, setCheckedWorkspaceIds] = useState<Set<string>>(new Set());
  const [selectedResultKey, setSelectedResultKey] = useState<string | null>(null);
  const [remoteQuery, setRemoteQuery] = useState('');
  const [remoteMatchCase, setRemoteMatchCase] = useState(false);
  const [remoteWorkspaceKey, setRemoteWorkspaceKey] = useState('');
  const [remoteResults, setRemoteResults] = useState<CrossTabSearchItem[]>([]);
  const [visibleCrossTabCount, setVisibleCrossTabCount] = useState(CROSS_TAB_RESULT_PAGE_SIZE);
  const [isCrossTabSearching, setIsCrossTabSearching] = useState(false);
  const [workspaceRemoteQuery, setWorkspaceRemoteQuery] = useState('');
  const [workspaceRemoteMatchCase, setWorkspaceRemoteMatchCase] = useState(false);
  const [workspaceRemoteResults, setWorkspaceRemoteResults] = useState<WorkspaceSearchResult[]>([]);
  const [isWorkspaceSearching, setIsWorkspaceSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef('');
  const workspaceRequestIdRef = useRef('');
  const openResetKeyRef = useRef('');
  const previousWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const { cardRef, beginResize, style } = useSearchOverlayResize(previewEnabled);
  useCssVars(cardRef, style);

  const hasCrossTabSearch = Boolean(crossTabItems && onCrossTabSelect);
  const workspaceChoices = useMemo<WorkspaceChoice[]>(() => buildWorkspaceChoices(
    hasCrossTabSearch ? crossTabItems : undefined,
    state.workspaceName || t.search.modalTitleCurrent,
    state.workspacePath,
    t.search.allWorkspaces,
  ), [crossTabItems, hasCrossTabSearch, state.workspaceName, state.workspacePath, t.search.allWorkspaces, t.search.modalTitleCurrent]);
  const actualWorkspaceIds = useMemo(
    () => workspaceChoices.filter((workspace) => workspace.id !== 'all').map((workspace) => workspace.id),
    [workspaceChoices],
  );
  const enabledWorkspaceIds = useMemo(
    () => actualWorkspaceIds.filter((workspaceId) => checkedWorkspaceIds.has(workspaceId)),
    [actualWorkspaceIds, checkedWorkspaceIds],
  );
  const enabledWorkspaceKey = enabledWorkspaceIds.join('\u0000');

  const openResetKey = `${scopeKey ?? ''}\u0000${hasCrossTabSearch ? 'all-tabs' : 'current'}`;

  useEffect(() => {
    if (!isOpen) {
      openResetKeyRef.current = '';
      return;
    }
    if (openResetKeyRef.current === openResetKey) return;
    openResetKeyRef.current = openResetKey;
    setQuery('');
    setMatchCase(false);
    setPreviewEnabledState(persistentSearchPreviewEnabled);
    setSelectedWorkspaceId(hasCrossTabSearch ? 'all' : 'current');
    setSelectedResultKey(null);
    setRemoteQuery('');
    setRemoteMatchCase(false);
    setRemoteWorkspaceKey('');
    setRemoteResults([]);
    setVisibleCrossTabCount(CROSS_TAB_RESULT_PAGE_SIZE);
    setIsCrossTabSearching(false);
    setWorkspaceRemoteQuery('');
    setWorkspaceRemoteMatchCase(false);
    setWorkspaceRemoteResults([]);
    setIsWorkspaceSearching(false);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(focusTimer);
  }, [hasCrossTabSearch, isOpen, openResetKey]);

  useEffect(() => {
    if (!isOpen) {
      previousWorkspaceIdsRef.current = new Set();
      setCheckedWorkspaceIds(new Set());
      return;
    }
    const previousIds = previousWorkspaceIdsRef.current;
    const actualIds = new Set(actualWorkspaceIds);
    setCheckedWorkspaceIds((current) => {
      const next = new Set([...current].filter((workspaceId) => actualIds.has(workspaceId)));
      for (const workspaceId of actualWorkspaceIds) {
        if (!previousIds.has(workspaceId)) next.add(workspaceId);
      }
      return next;
    });
    previousWorkspaceIdsRef.current = actualIds;
  }, [actualWorkspaceIds, isOpen]);

  const trimmedQuery = query.trim();
  const currentWorkspaceEnabled = checkedWorkspaceIds.has('current');
  const currentTabResults = useMemo(
    () => currentWorkspaceEnabled ? buildCurrentTabResults(state.fileList, trimmedQuery, matchCase) : [],
    [currentWorkspaceEnabled, matchCase, state.fileList, trimmedQuery],
  );

  const displayedCrossTabResults = useMemo(() => {
    if (!hasCrossTabSearch || remoteQuery !== query || remoteMatchCase !== matchCase || remoteWorkspaceKey !== enabledWorkspaceKey) return [];
    return remoteResults
      .filter((item) => checkedWorkspaceIds.has(item.tabId))
      .filter((item) => selectedWorkspaceId === 'all' || item.tabId === selectedWorkspaceId)
      .slice(0, visibleCrossTabCount)
      .map((item) => ({ item, score: 0 }));
  }, [checkedWorkspaceIds, enabledWorkspaceKey, hasCrossTabSearch, matchCase, query, remoteMatchCase, remoteQuery, remoteResults, remoteWorkspaceKey, selectedWorkspaceId, visibleCrossTabCount]);

  const displayedWorkspaceResults = useMemo(() => {
    if (hasCrossTabSearch || !currentWorkspaceEnabled) return [];
    return workspaceRemoteQuery === query && workspaceRemoteMatchCase === matchCase
      ? workspaceRemoteResults.map((item) => ({ item, score: 0 }))
      : currentTabResults;
  }, [currentTabResults, currentWorkspaceEnabled, hasCrossTabSearch, matchCase, query, workspaceRemoteMatchCase, workspaceRemoteQuery, workspaceRemoteResults]);

  const displayedResults = hasCrossTabSearch ? displayedCrossTabResults : displayedWorkspaceResults;
  const isSearching = hasCrossTabSearch ? isCrossTabSearching : isWorkspaceSearching;

  // Stabilise the selectedResult object reference: even though displayedResults is a
  // new array on every scan batch, the memoized value only changes when selectedResultKey
  // itself changes. This prevents SearchDocumentPreview from receiving a new object
  // reference on every incremental batch, which was the root cause of repeated re-fetches.
  const selectedResult = useMemo(
    () => displayedResults.find(({ item }) => resultKey(item) === selectedResultKey)?.item ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedResultKey],  // intentional: only recompute when the key changes, not on every batch
  );

  useEffect(() => {
    if (displayedResults.length === 0) {
      setSelectedResultKey(null);
      return;
    }
    if (!displayedResults.some(({ item }) => resultKey(item) === selectedResultKey)) {
      setSelectedResultKey(resultKey(displayedResults[0].item));
    }
  }, [displayedResults, selectedResultKey]);

  const openResult = useCallback((item: SearchResultItem) => {
    onClose();
    if (isCrossTabItem(item)) {
      onCrossTabSelect?.(item, query, matchCase);
      return;
    }
    if (onWorkspaceSelect) {
      onWorkspaceSelect(item, query, matchCase);
      return;
    }
    navigate(item.fsPath);
  }, [matchCase, navigate, onClose, onCrossTabSelect, onWorkspaceSelect, query]);

  const toggleWorkspace = useCallback((workspaceId: string, checked: boolean) => {
    setCheckedWorkspaceIds((current) => {
      if (workspaceId === 'all') return checked ? new Set(actualWorkspaceIds) : new Set();
      const next = new Set(current);
      if (checked) next.add(workspaceId);
      else next.delete(workspaceId);
      return next;
    });
  }, [actualWorkspaceIds]);

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch) return;
    return bridge.onMessage((msg) => {
      if (msg.command !== 'crossTabSearchResults' || msg.requestId !== requestIdRef.current) return;
      setRemoteQuery(query);
      setRemoteMatchCase(matchCase);
      setRemoteWorkspaceKey(enabledWorkspaceKey);
      if (msg.done) setIsCrossTabSearching(false);
      else setRemoteResults((current) => [...current, ...(msg.results as CrossTabSearchItem[])]);
    });
  }, [bridge, enabledWorkspaceKey, hasCrossTabSearch, isOpen, matchCase, query]);

  useEffect(() => {
    if (!isOpen || hasCrossTabSearch) return;
    return bridge.onMessage((msg) => {
      if (msg.command !== 'workspaceSearchResults' || msg.requestId !== workspaceRequestIdRef.current) return;
      setWorkspaceRemoteQuery(query);
      setWorkspaceRemoteMatchCase(matchCase);
      setWorkspaceRemoteResults(msg.results as WorkspaceSearchResult[]);
      setIsWorkspaceSearching(false);
    });
  }, [bridge, hasCrossTabSearch, isOpen, matchCase, query]);

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch || !crossTabItems || trimmedQuery.length < 2 || enabledWorkspaceIds.length === 0) {
      setRemoteQuery('');
      setRemoteWorkspaceKey('');
      setRemoteResults([]);
      setVisibleCrossTabCount(CROSS_TAB_RESULT_PAGE_SIZE);
      setIsCrossTabSearching(false);
      return;
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdRef.current = requestId;
    setRemoteQuery(query);
    setRemoteMatchCase(matchCase);
    setRemoteWorkspaceKey(enabledWorkspaceKey);
    setRemoteResults([]);
    setVisibleCrossTabCount(CROSS_TAB_RESULT_PAGE_SIZE);
    setIsCrossTabSearching(true);
    setSelectedResultKey(null);
    const handle = window.setTimeout(() => bridge.postMessage({
      command: 'searchAcrossWorkspaces', requestId, query, matchCase, tabIds: enabledWorkspaceIds,
    }), 160);
    return () => window.clearTimeout(handle);
  }, [bridge, crossTabItems, enabledWorkspaceKey, hasCrossTabSearch, isOpen, matchCase, query, trimmedQuery.length]);

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch || !crossTabItems?.length) return;
    const handle = window.setTimeout(() => bridge.postMessage({ command: 'indexWorkspaceSearchItems', items: crossTabItems }), 100);
    return () => window.clearTimeout(handle);
  }, [bridge, crossTabItems, hasCrossTabSearch, isOpen]);

  useEffect(() => {
    if (!isOpen || hasCrossTabSearch || trimmedQuery.length < 2 || !currentWorkspaceEnabled) {
      setWorkspaceRemoteQuery('');
      setWorkspaceRemoteResults([]);
      setIsWorkspaceSearching(false);
      return;
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    workspaceRequestIdRef.current = requestId;
    setIsWorkspaceSearching(true);
    setSelectedResultKey(null);
    const handle = window.setTimeout(() => bridge.postMessage({
      command: 'searchWorkspace', requestId, query, matchCase, items: state.fileList.map(toWorkspaceSearchResult),
    }), 160);
    return () => window.clearTimeout(handle);
  }, [bridge, currentWorkspaceEnabled, hasCrossTabSearch, isOpen, matchCase, query, state.fileList, trimmedQuery.length]);

  if (!isOpen) return null;

  // isSearching already computed above for useDeferredValue stabilisation
  const modalTitle = hasCrossTabSearch ? t.search.modalTitleAllTabs : t.search.modalTitleCurrent;
  const placeholder = isIndexing ? t.search.indexingPlaceholder : scopeLabel ?? (hasCrossTabSearch ? t.search.allWorkspacesPlaceholder : t.search.currentWorkspacePlaceholder);
  const countByWorkspace = new Map<string, number>();
  for (const workspace of workspaceChoices) {
    const count = workspace.id === 'all'
      ? remoteResults.filter((item) => checkedWorkspaceIds.has(item.tabId)).length
      : hasCrossTabSearch
        ? remoteResults.filter((item) => item.tabId === workspace.id).length
        : displayedWorkspaceResults.length;
    countByWorkspace.set(workspace.id, count);
  }
  const selectedPoolCount = remoteResults.filter((item) => checkedWorkspaceIds.has(item.tabId))
    .filter((item) => selectedWorkspaceId === 'all' || item.tabId === selectedWorkspaceId).length;

  const overlay = (
    <div className="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label={t.search.dialogLabel}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
      <div ref={cardRef} className="search-overlay-card">
        <header className="search-overlay-header">
          <div><div className="search-overlay-title">{modalTitle}</div><div className="search-overlay-subtitle">{state.workspaceName}</div></div>
          <TooltipButton className="search-overlay-close" onClick={onClose} tooltip={t.tooltips.closeModal} shortcut="Esc"
            tooltipPos="below" tooltipAlign="right" icon={<CloseIcon size={15} />} />
        </header>

        <div className="search-overlay-input-row">
          {isIndexing ? <div className="spinner" /> : <SearchIcon size={16} className="search-icon" />}
          <input ref={inputRef} type="text" className="search-overlay-input" placeholder={placeholder} value={query}
            onChange={(event) => setQuery(event.target.value)} disabled={isIndexing} aria-label={t.search.queryLabel} />
          <TooltipButton type="button" className={`search-overlay-case-toggle${matchCase ? ' is-active' : ''}`}
            onClick={() => setMatchCase((value) => !value)} tooltip={`${t.search.matchCase} - ${matchCase ? (t.search.statusOn || 'On') : (t.search.statusOff || 'Off')}`} tooltipPos="below" aria-pressed={matchCase}>Aa</TooltipButton>
          <TooltipButton type="button" className={`search-overlay-preview-toggle${previewEnabled ? ' is-active' : ''}`}
            onClick={() => setPreviewEnabled((value) => !value)} tooltip={`${t.search.preview} - ${previewEnabled ? (t.search.statusOn || 'On') : (t.search.statusOff || 'Off')}`} tooltipPos="below" aria-pressed={previewEnabled}>{t.search.preview}</TooltipButton>
        </div>

        <div className={`search-overlay-layout${previewEnabled ? '' : ' is-preview-hidden'}`}>
          <SearchOverlayWorkspaceList workspaces={workspaceChoices} selectedWorkspaceId={selectedWorkspaceId}
            checkedWorkspaceIds={checkedWorkspaceIds} counts={countByWorkspace}
            translations={{ workspaces: t.search.workspaces, includeWorkspace: t.search.includeWorkspace,
              excludeWorkspace: t.search.excludeWorkspace, checkAllWorkspaces: t.search.checkAllWorkspaces,
              uncheckAllWorkspaces: t.search.uncheckAllWorkspaces }}
            onSelect={setSelectedWorkspaceId} onToggle={toggleWorkspace} />
          <div className="search-overlay-resize-handle" role="separator" aria-orientation="vertical"
            aria-label={t.search.resizeWorkspaces} onPointerDown={(event) => beginResize('workspaces', event)} />
          <SearchOverlayResults results={displayedResults} selectedResultKey={selectedResultKey} query={query}
            matchCase={matchCase} previewEnabled={previewEnabled} showTitle={state.settings.showTitle}
            isSearching={isSearching} hasCrossTabSearch={hasCrossTabSearch}
            canLoadMore={selectedPoolCount > displayedCrossTabResults.length}
            translations={{ results: t.search.results, minimumCharacters: t.search.minimumCharacters,
              searchingContents: t.search.searchingContents, noMatches: t.search.noMatches,
              fileNameOrPathMatch: t.search.fileNameOrPathMatch, openResult: t.search.openResult,
              loadMore: t.actions.loadMore }}
            onSelect={setSelectedResultKey} onOpen={openResult}
            onLoadMore={() => setVisibleCrossTabCount((count) => count + CROSS_TAB_RESULT_PAGE_SIZE)} />

          {previewEnabled && <>
            <div className="search-overlay-resize-handle search-overlay-resize-handle--preview" role="separator"
              aria-orientation="vertical" aria-label={t.search.resizePreview}
              onPointerDown={(event) => beginResize('preview', event)} />
            <aside className="search-overlay-preview" aria-label={t.search.preview}>
              <div className="search-overlay-section-header search-overlay-preview__header">
                <span className="search-overlay-preview__file-name">{selectedResult?.fileName ?? t.search.preview}</span>
                {selectedResult && <TooltipButton type="button" className="search-overlay-preview__open"
                  onClick={() => openResult(selectedResult)} tooltip={t.search.openResult} tooltipPos="below"
                  tooltipAlign="right" icon={<ChevronRightIcon size={15} />} />}
              </div>
              {selectedResult ? <SearchDocumentPreview bridge={bridge} item={selectedResult} query={query}
                matchCase={matchCase} theme={state.theme} settings={state.settings} loadingLabel={t.search.loadingPreview}
                errorLabel={t.search.previewUnavailable} /> : <div className="search-overlay-preview__empty">
                <strong>{t.search.previewEmptyTitle}</strong><span>{t.search.previewEmptyBody}</span>
              </div>}
            </aside>
          </>}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
