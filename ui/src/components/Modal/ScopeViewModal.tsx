import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { resolveRenderedLink, type ResolvedLink } from '../../dom/linkContextMenu';
import { findScopeFile, loadDocumentSnapshot } from '../../export/documentSnapshot';
import type { MdFile } from '../../types/files';
import { scheduleContentEnhancements } from '../Content/scheduleContentEnhancements';
import { LinkContextMenu } from '../shared/LinkContextMenu';
import { ChevronLeftIcon, ChevronRightIcon } from '../shared/icons';
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
}

interface ScopeContextMenuState {
  x: number;
  y: number;
  anchor: HTMLAnchorElement;
  link: ResolvedLink;
  target: MdFile;
}

export function ScopeViewModal({ initialFile, files, onClose }: ScopeViewModalProps) {
  const { state } = useAppState();
  const bridge = usePlatform();
  const bodyRef = useRef<HTMLDivElement>(null);
  const mermaidRunIdRef = useRef(0);
  const [history, setHistory] = useState<ScopeHistoryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ScopeContextMenuState | null>(null);

  useEffect(() => {
    if (!initialFile) {
      setHistory(null);
      setError(null);
      setNotice(null);
      setContextMenu(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    setContextMenu(null);
    void loadDocumentSnapshot(bridge, initialFile, state.settings)
      .then((snapshot) => {
        if (!active) return;
        setHistory(createScopeHistory({ file: initialFile, snapshot }));
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Unable to open scope');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [bridge, initialFile, state.settings]);

  useEffect(() => {
    if (!initialFile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
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

  const goPrevious = useCallback(() => {
    setHistory((value) => value ? previousScope(value) : value);
  }, []);

  const goNext = useCallback(() => {
    setHistory((value) => value ? nextScope(value) : value);
  }, []);

  useEffect(() => {
    const detail: ScopeNavigationStateDetail = {
      active: Boolean(initialFile),
      canPrevious,
      canNext,
    };
    window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, { detail }));
  }, [canNext, canPrevious, initialFile]);

  useEffect(() => () => {
    const detail: ScopeNavigationStateDetail = { active: false, canPrevious: false, canNext: false };
    window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, { detail }));
  }, []);

  useEffect(() => {
    if (!initialFile) return;
    const handleNavigationRequest = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: ScopeNavigationDirection }>).detail?.direction;
      if (direction === 'previous') goPrevious();
      if (direction === 'next') goNext();
    };
    window.addEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, handleNavigationRequest);
    return () => window.removeEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, handleNavigationRequest);
  }, [goNext, goPrevious, initialFile]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !current) return;
    return scheduleContentEnhancements({
      body,
      state,
      scrollRef: { current: null },
      handleScroll: () => {},
      mermaidRunIdRef,
    });
  }, [current, state]);

  const openNestedScope = useCallback(async (target: MdFile) => {
    if (!history) return;
    if (history.entries.slice(0, history.index + 1).length >= MAX_SCOPE_DEPTH) {
      setNotice('Maximum scope depth reached');
      setContextMenu(null);
      return;
    }
    setNotice(null);
    setError(null);
    setContextMenu(null);
    setLoading(true);
    try {
      const snapshot = await loadDocumentSnapshot(bridge, target, state.settings);
      const result = pushScope(history, { file: target, snapshot });
      if (result.blocked) {
        setNotice('Maximum scope depth reached');
        return;
      }
      setHistory(result.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open scope');
    } finally {
      setLoading(false);
    }
  }, [bridge, history, state.settings]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !current) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href], a[data-mdn-target]');
      if (!anchor || !body.contains(anchor)) return;

      const link = resolveRenderedLink(anchor, current.file.fsPath);
      if (link.kind === 'fragment') {
        event.preventDefault();
        const fragment = link.raw.startsWith('#') ? link.raw.slice(1) : new URL(link.resolved).hash.slice(1);
        const id = decodeURIComponent(fragment);
        body.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' });
        return;
      }

      const scopeFile = findScopeFile(link, files);
      if (scopeFile) {
        event.preventDefault();
        event.stopPropagation();
        void openNestedScope(scopeFile);
        return;
      }

      if (link.kind === 'web' && link.openable) {
        event.preventDefault();
        bridge.postMessage({ command: 'openExternal', url: link.resolved });
        return;
      }

      if (link.kind === 'file' || link.kind === 'relative') {
        event.preventDefault();
        setNotice('This link is outside the current scope workspace');
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href], a[data-mdn-target]');
      if (!anchor || !body.contains(anchor)) return;
      const link = resolveRenderedLink(anchor, current.file.fsPath);
      const scopeFile = findScopeFile(link, files);
      if (!scopeFile) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        anchor,
        link,
        target: scopeFile,
      });
    };

    body.addEventListener('click', handleClick);
    body.addEventListener('contextmenu', handleContextMenu);
    return () => {
      body.removeEventListener('click', handleClick);
      body.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [bridge, current, files, openNestedScope]);

  if (!initialFile) return null;

  return (
    <div
      className="mdn-modal scope-view"
      role="dialog"
      aria-modal="true"
      aria-label="Scope view"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="scope-view__card">
        <header className="scope-view__header">
          <div className="scope-view__navigation">
            <button
              type="button"
              className="btn btn--icon scope-view__nav-button"
              aria-label="Previous scope"
              disabled={!canPrevious}
              onClick={goPrevious}
            >
              <ChevronLeftIcon size={14} />
            </button>
            <button
              type="button"
              className="btn btn--icon scope-view__nav-button"
              aria-label="Next scope"
              disabled={!canNext}
              onClick={goNext}
            >
              <ChevronRightIcon size={14} />
            </button>
          </div>

          <div className="scope-view__identity">
            <strong>{current ? `${current.file.title} — ${current.file.relativePath}` : initialFile.relativePath}</strong>
          </div>

          <div
            className="scope-view__depth"
            aria-label={`Scope level ${depth} of ${MAX_SCOPE_DEPTH}`}
            title={`Scope level ${depth} of ${MAX_SCOPE_DEPTH}`}
          >
            {Array.from({ length: MAX_SCOPE_DEPTH }, (_, index) => (
              <div
                key={index}
                className={`scope-view__depth-segment${index < depth ? ' is-filled' : ''}${index === depth - 1 ? ' is-current' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>

          <button type="button" className="btn btn--icon scope-view__close" aria-label="Close scope" onClick={onClose}>×</button>
        </header>

        <div className="scope-view__content">
          {loading && !current && <div className="scope-view__state"><div className="spinner" />Loading scope…</div>}
          {error && <div className="scope-view__state scope-view__state--error" role="alert">{error}</div>}
          {current && (
            <div className="scope-view__scroll">
              <div
                ref={bodyRef}
                className="mdn-body scope-view__document"
                dangerouslySetInnerHTML={{ __html: current.snapshot.html }}
              />
            </div>
          )}
          {loading && current && <div className="scope-view__loading-overlay"><div className="spinner" /></div>}
        </div>

        {notice && <div className="scope-view__notice" role="status">{notice}</div>}
      </section>

      {contextMenu && (
        <LinkContextMenu
          state={{ x: contextMenu.x, y: contextMenu.y, anchor: contextMenu.anchor, link: contextMenu.link }}
          menuLabel="Scope link menu"
          openLabel="Open in browser"
          copyLabel="Copy link"
          scopeLabel="Open as scope"
          onOpenScope={() => { void openNestedScope(contextMenu.target); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
