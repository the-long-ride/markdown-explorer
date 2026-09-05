import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { formatFeatureText, getExportScopeTranslations } from '../../contexts/exportScopeTranslations';
import { usePlatform } from '../../contexts/PlatformContext';
import { resolveRenderedLink, type ResolvedLink } from '../../dom/linkContextMenu';
import { findScopeFile, loadDocumentSnapshot } from '../../export/documentSnapshot';
import { matchesShortcut } from '../../hooks/keyboardUtils';
import type { MdFile } from '../../types/files';
import { dispatchActionNotice } from '../../utils/actionNotice';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { attachMouseHistoryNavigation } from '../../utils/mouseHistoryNavigation';
import { syncStickyTableHeaders } from '../Content/contentUtils';
import type { HeadingSectionState } from '../Content/enhancements/headingSectionState';
import { createHeadingSectionInteractions } from '../Content/headingSectionInteractions';
import { installMermaidContentLifecycle } from '../Content/mermaidContentLifecycle';
import { scheduleContentEnhancements } from '../Content/scheduleContentEnhancements';
import { LinkContextMenu } from '../shared/LinkContextMenu';
import { TooltipButton } from '../shared/TooltipButton';
import { ChevronLeftIcon, ChevronRightIcon, OpenFileIcon } from '../shared/icons';
import {
  MAX_SCOPE_DEPTH,
  SCOPE_NAVIGATION_REQUEST_EVENT,
  SCOPE_NAVIGATION_STATE_EVENT,
  createScopeHistory,
  nextScope,
  previousScope,
  pushScope,
  type ScopeHistoryState,
  type ScopeNavigationDirection,
  type ScopeNavigationStateDetail,
} from './scopeHistory';

interface ScopeViewModalProps {
  initialFile: MdFile | null;
  files: readonly MdFile[];
  onClose: () => void;
  onMediaClick?: (element: HTMLElement) => void;
}

interface ScopeContextMenuState {
  x: number;
  y: number;
  anchor: HTMLAnchorElement;
  link: ResolvedLink;
  target: MdFile;
}

const SCOPE_ALREADY_VIEWING_MESSAGES: Record<string, string> = {
  en: 'You are currently viewing this document.', vi: 'Bạn đang xem tài liệu này.',
  fr: 'Vous consultez actuellement ce document.', es: 'Actualmente estás viendo este documento.',
  zh: '您当前正在查看此文档。', no: 'Du viser dette dokumentet nå.', ja: '現在このドキュメントを表示しています。',
  ko: '현재 이 문서를 보고 있습니다.', ru: 'Вы уже просматриваете этот документ.',
};

const SCOPE_CLOSE_LABELS: Record<string, string> = {
  en: 'Close scope view', vi: 'Đóng chế độ xem phạm vi', fr: 'Fermer la vue de portée',
  es: 'Cerrar vista de ámbito', zh: '关闭范围视图', no: 'Lukk omfangsvisning', ja: 'スコープビューを閉じる',
  ko: '범위 보기 닫기', ru: 'Закрыть просмотр области',
};

function getScopeAlreadyViewingMessage(language?: string): string {
  return SCOPE_ALREADY_VIEWING_MESSAGES[language || 'en'] || SCOPE_ALREADY_VIEWING_MESSAGES.en;
}
function getScopeCloseLabel(language?: string): string {
  return SCOPE_CLOSE_LABELS[language || 'en'] || SCOPE_CLOSE_LABELS.en;
}
function normalizeScopePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}
function isSameScopeFile(left: MdFile | undefined, right: MdFile): boolean {
  return Boolean(left && normalizeScopePath(left.fsPath) === normalizeScopePath(right.fsPath));
}

export function ScopeViewModal({ initialFile, files, onClose, onMediaClick }: ScopeViewModalProps) {
  const { state } = useAppState();
  const scopeT = getExportScopeTranslations(state.settings.language).scopeView;
  const bridge = usePlatform();
  const bridgeRef = useRef(bridge);
  const settingsRef = useRef(state.settings);
  const scopeTRef = useRef(scopeT);
  const languageRef = useRef(state.settings.language);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mermaidRunIdRef = useRef(0);
  const lastMermaidAppearanceKeyRef = useRef<string | null>(null);
  const headingStateByFileRef = useRef<Map<string, HeadingSectionState>>(new Map());
  const [history, setHistory] = useState<ScopeHistoryState | null>(null);
  const historyRef = useRef<ScopeHistoryState | null>(history);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ScopeContextMenuState | null>(null);

  bridgeRef.current = bridge;
  settingsRef.current = state.settings;
  scopeTRef.current = scopeT;
  languageRef.current = state.settings.language;
  historyRef.current = history;

  useEffect(() => {
    if (!initialFile) {
      historyRef.current = null;
      setHistory(null);
      setError(null);
      setNotice(null);
      setContextMenu(null);
      headingStateByFileRef.current.clear();
      return;
    }
    const file = initialFile;
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    setContextMenu(null);
    void loadDocumentSnapshot(bridgeRef.current, file, settingsRef.current)
      .then((snapshot) => {
        if (!active) return;
        const nextHistory = createScopeHistory({ file, snapshot });
        historyRef.current = nextHistory;
        setHistory(nextHistory);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : scopeTRef.current.unableOpen);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialFile?.fsPath]);

  useLayoutEffect(() => {
    if (!initialFile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (contextMenu) { setContextMenu(null); return; }
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [contextMenu, initialFile, onClose]);

  const current = history?.entries[history.index] ?? null;
  const depth = history ? history.index + 1 : 1;
  const canPrevious = Boolean(history && history.index > 0);
  const canNext = Boolean(history && history.index < history.entries.length - 1);
  const backShortcut = getEnabledShortcut(state.settings, 'back');
  const forwardShortcut = getEnabledShortcut(state.settings, 'forward');

  const goPrevious = useCallback(() => setHistory((val) => { const n = val ? previousScope(val) : val; historyRef.current = n; return n; }), []);
  const goNext = useCallback(() => setHistory((val) => { const n = val ? nextScope(val) : val; historyRef.current = n; return n; }), []);
  const handleOpenFile = useCallback(() => {
    if (!current) return;
    bridgeRef.current.postMessage({ command: 'navigate', path: current.file.fsPath });
    onClose();
  }, [current, onClose]);
  const handleScopeScroll = useCallback(() => syncStickyTableHeaders(scrollRef.current), []);

  useEffect(() => {
    const detail: ScopeNavigationStateDetail = { active: Boolean(initialFile), canPrevious, canNext };
    window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, { detail }));
  }, [canNext, canPrevious, initialFile]);

  useEffect(() => () => {
    const detail: ScopeNavigationStateDetail = { active: false, canPrevious: false, canNext: false };
    window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, { detail }));
  }, []);

  useLayoutEffect(() => {
    if (!initialFile) return;
    const handleNav = (e: Event) => {
      const dir = (e as CustomEvent<{ direction?: ScopeNavigationDirection }>).detail?.direction;
      if (dir === 'previous') goPrevious();
      if (dir === 'next') goNext();
    };
    window.addEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, handleNav);
    return () => window.removeEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, handleNav);
  }, [goNext, goPrevious, initialFile]);

  useLayoutEffect(() => {
    if (!initialFile) return;
    const handleHistoryKey = (event: KeyboardEvent) => {
      const isBrowserBack = event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft' && !event.ctrlKey && !event.metaKey && !event.shiftKey);
      const isBrowserForward = event.key === 'BrowserForward' || (event.altKey && event.key === 'ArrowRight' && !event.ctrlKey && !event.metaKey && !event.shiftKey);
      let direction: ScopeNavigationDirection | null = null;
      if (isBrowserBack || (backShortcut && matchesShortcut(event, backShortcut))) direction = 'previous';
      else if (isBrowserForward || (forwardShortcut && matchesShortcut(event, forwardShortcut))) direction = 'next';
      if (!direction) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (direction === 'previous') goPrevious();
      else goNext();
    };
    const detachHistoryMouse = attachMouseHistoryNavigation((dir) => { (dir === 'back') ? goPrevious() : goNext(); }, { capture: true });
    window.addEventListener('keydown', handleHistoryKey, true);
    return () => { window.removeEventListener('keydown', handleHistoryKey, true); detachHistoryMouse(); };
  }, [backShortcut, forwardShortcut, goNext, goPrevious, initialFile]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !current) return;
    const headingSections = createHeadingSectionInteractions({
      body, currentFile: current.file.fsPath,
      defaultExpanded: state.defaultExpanded !== false, stateByFile: headingStateByFileRef.current,
    });
    const startEnhancements = () => scheduleContentEnhancements({ body, state, scrollRef, handleScroll: handleScopeScroll, mermaidRunIdRef });
    const disposeMermaidLifecycle = installMermaidContentLifecycle({ body, state, previousAppearanceKeyRef: lastMermaidAppearanceKeyRef, runIdRef: mermaidRunIdRef, startEnhancements });
    handleScopeScroll();
    return () => { disposeMermaidLifecycle(); headingSections.dispose(); };
  }, [current, handleScopeScroll, state.defaultExpanded, state.theme, state.themeStyle, state.settings.activeCustomThemeId, state.settings.customThemes, state.settings.fontBindings]);

  const openNestedScope = useCallback(async (target: MdFile) => {
    const latestHistory = historyRef.current;
    if (!latestHistory) return;
    if (isSameScopeFile(latestHistory.entries[latestHistory.index]?.file, target)) {
      setNotice(null); setContextMenu(null);
      dispatchActionNotice(getScopeAlreadyViewingMessage(languageRef.current));
      return;
    }
    if (latestHistory.entries.slice(0, latestHistory.index + 1).length >= MAX_SCOPE_DEPTH) {
      setNotice(scopeTRef.current.maximumDepth); setContextMenu(null); return;
    }
    setNotice(null); setError(null); setContextMenu(null); setLoading(true);
    try {
      const snapshot = await loadDocumentSnapshot(bridgeRef.current, target, settingsRef.current);
      const cur = historyRef.current;
      if (!cur) return;
      const result = pushScope(cur, { file: target, snapshot });
      if (result.blocked) { setNotice(scopeTRef.current.maximumDepth); return; }
      historyRef.current = result.state; setHistory(result.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : scopeTRef.current.unableOpen);
    } finally { setLoading(false); }
  }, []);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !current) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !body.contains(target)) return;

      const viewOption = target.closest<HTMLElement>('.mdn-table-view-menu__option');
      if (viewOption && body.contains(viewOption)) {
        event.preventDefault(); event.stopPropagation();
        const dropdown = viewOption.closest<HTMLElement>('.mdn-table-view-dropdown');
        const value = viewOption.getAttribute('data-value');
        if (dropdown?.id && value) {
          const tableId = dropdown.id.replace('-view-dropdown', '');
          const table = (window as typeof window & { Table?: any }).Table;
          table?.switchView?.(tableId, value); table?.closeViewDropdown?.(tableId);
        }
        return;
      }
      const viewSelect = target.closest<HTMLElement>('.mdn-table-view-select');
      if (viewSelect && body.contains(viewSelect)) {
        event.preventDefault(); event.stopPropagation();
        const dropdown = viewSelect.closest<HTMLElement>('.mdn-table-view-dropdown');
        if (dropdown?.id) (window as typeof window & { Table?: any }).Table?.toggleViewDropdown?.(dropdown.id.replace('-view-dropdown', ''), event);
        return;
      }
      const image = target.closest<HTMLElement>('img');
      if (image && body.contains(image) && onMediaClick) { event.preventDefault(); event.stopPropagation(); onMediaClick(image); return; }
      const mermaidTarget = target.closest<HTMLElement>('.mdn-mermaid-wrap, .mermaid, svg');
      if (mermaidTarget && body.contains(mermaidTarget) && onMediaClick) {
        event.preventDefault(); event.stopPropagation();
        onMediaClick(mermaidTarget.closest<HTMLElement>('.mdn-mermaid-wrap') ?? mermaidTarget.closest<HTMLElement>('.mermaid') ?? mermaidTarget);
        return;
      }
      const anchor = target.closest<HTMLAnchorElement>('a[href], a[data-mdn-target]');
      if (!anchor || !body.contains(anchor)) return;
      const link = resolveRenderedLink(anchor, current.file.fsPath);
      if (link.kind === 'fragment') {
        event.preventDefault();
        const id = decodeURIComponent(link.raw.startsWith('#') ? link.raw.slice(1) : new URL(link.resolved).hash.slice(1));
        body.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' });
        return;
      }
      const scopeFile = findScopeFile(link, files);
      if (scopeFile) { event.preventDefault(); event.stopPropagation(); void openNestedScope(scopeFile); return; }
      if (link.kind === 'web' && link.openable) { event.preventDefault(); bridgeRef.current.postMessage({ command: 'openExternal', url: link.resolved }); return; }
      if (link.kind === 'file' || link.kind === 'relative') { event.preventDefault(); setNotice(scopeTRef.current.outsideWorkspace); }
    };
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href], a[data-mdn-target]');
      if (!anchor || !body.contains(anchor)) return;
      const link = resolveRenderedLink(anchor, current.file.fsPath);
      const scopeFile = findScopeFile(link, files);
      if (!scopeFile) return;
      event.preventDefault(); event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY, anchor, link, target: scopeFile });
    };
    body.addEventListener('click', handleClick);
    body.addEventListener('contextmenu', handleContextMenu);
    return () => { body.removeEventListener('click', handleClick); body.removeEventListener('contextmenu', handleContextMenu); };
  }, [current, files, onMediaClick, openNestedScope]);

  if (!initialFile) return null;
  const levelLabel = formatFeatureText(scopeT.level, { depth, max: MAX_SCOPE_DEPTH });
  return (
    <div className="mdn-modal mdn-app-modal-region scope-view" role="dialog" aria-modal="true" aria-label={scopeT.dialogLabel} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="scope-view__card">
        <header className="scope-view__header">
          <div className="scope-view__navigation">
            <TooltipButton className="btn btn--icon scope-view__nav-button" tooltip={scopeT.previous} shortcut={backShortcut} disabled={!canPrevious} onClick={goPrevious} icon={<ChevronLeftIcon size={14} />} />
            <TooltipButton className="btn btn--icon scope-view__nav-button" tooltip={scopeT.next} shortcut={forwardShortcut} disabled={!canNext} onClick={goNext} icon={<ChevronRightIcon size={14} />} />
            <TooltipButton className="btn btn--icon scope-view__nav-button scope-view__open-file" tooltip={scopeT.openFile} disabled={!current} onClick={handleOpenFile} icon={<OpenFileIcon size={13} />} />
          </div>
          <div className="scope-view__identity"><strong>{current ? `${current.file.title} — ${current.file.relativePath}` : initialFile.relativePath}</strong></div>
          <div className="scope-view__depth" aria-label={levelLabel} title={levelLabel}>
            {Array.from({ length: MAX_SCOPE_DEPTH }, (_, index) => (
              <div key={index} className={`scope-view__depth-segment${index < depth ? ' is-filled' : ''}${index === depth - 1 ? ' is-current' : ''}`} aria-hidden="true" />
            ))}
          </div>
          <TooltipButton className="settings-card__close scope-view__close" tooltip={scopeT.close} label={getScopeCloseLabel(state.settings.language)} shortcut="Esc" tooltipPos="below" tooltipAlign="right" onClick={onClose}>×</TooltipButton>
        </header>
        <div className="scope-view__content">
          {loading && !current && <div className="scope-view__state"><div className="spinner" />{scopeT.loading}</div>}
          {error && <div className="scope-view__state scope-view__state--error" role="alert">{error}</div>}
          {current && <div ref={scrollRef} className="scope-view__scroll" onScroll={handleScopeScroll}><div ref={bodyRef} className="mdn-body scope-view__document" dangerouslySetInnerHTML={{ __html: current.snapshot.html }} /></div>}
          {loading && current && <div className="scope-view__loading-overlay"><div className="spinner" /></div>}
        </div>
        {notice && <div className="scope-view__notice" role="status">{notice}</div>}
      </section>
      {contextMenu && (
        <LinkContextMenu
          state={{ x: contextMenu.x, y: contextMenu.y, anchor: contextMenu.anchor, link: contextMenu.link }}
          menuLabel={scopeT.linkMenu} openLabel={scopeT.openInBrowser} copyLabel={scopeT.copyLink}
          scopeLabel={scopeT.openAsScope} onOpenScope={() => { void openNestedScope(contextMenu.target); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}