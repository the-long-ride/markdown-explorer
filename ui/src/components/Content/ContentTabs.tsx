import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { getEditorUiTranslations } from "../../contexts/editorUiTranslations";
import { getTranslations } from "../../contexts/translations";
import { documentSessionKey, isDocumentDirty } from "../../editor/documentSession";
import {
  TabContextMenu,
  type TabContextMenuAction,
} from "../shared/TabContextMenu";
import { usePlatform } from "../../contexts/PlatformContext";
import { requestShellLocation, supportsShellLocation } from "../../desktop/shellLocation";
import { openLocalFileInBrowser } from "../../dom/htmlPreviewActions";
import {
  CONTENT_TAB_CLOSE_REQUEST_EVENT,
  type ContentTabCloseRequest,
} from "./contentTabCloseEvents";
import { ContentTabItem } from "./ContentTabItem";
import { buildContentTabContextMenuItems } from "./contentTabContextMenuItems";
import { useContentTabsScrollbar } from "./useContentTabsScrollbar";

export const CONTENT_TAB_CLOSE_FADE_MS = 90;
export const CONTENT_TAB_CLOSE_COLLAPSE_MS = 140;

type TabClosePhase = 'idle' | 'fade' | 'collapse';

export function ContentTabs() {
  const {
    state,
    activateContentTab,
    reorderContentTabs,
    closeContentTab,
    closeContentTabsToRight,
    closeOtherContentTabs,
    closeAllContentTabs,
    openInSplit,
    moveToOtherPane,
    swapSplitPanes,
    closeSplitView,
    guardUnsavedChanges = (_filePaths: string[], commit: () => void) => commit(),
    setContentTabHtmlPreview,
  } = useAppState();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const editorT = getEditorUiTranslations(currentLang);
  const bridge = usePlatform();
  const {
    tabsScrollRef, scrollbarTrackRef, scrollbarThumbRef, scrollbarMetrics,
    isScrollbarDragging, updateScrollbarMetrics, beginScrollbarDrag,
    handleScrollbarTrackPointerDown,
  } = useContentTabsScrollbar(state.activeContentTabPath, state.contentTabs);
  const [contextMenu, setContextMenu] = useState<{
    filePath: string;
    x: number;
    y: number;
  } | null>(null);
  const draggedTabPathRef = useRef<string | null>(null);
  const didDragRef = useRef(false);
  const [draggedTabPath, setDraggedTabPath] = useState<string | null>(null);
  const [closingTabPaths, setClosingTabPaths] = useState<Set<string>>(() => new Set());
  const [closingPhase, setClosingPhase] = useState<TabClosePhase>('idle');
  const tabElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const closeTimersRef = useRef<number[]>([]);
  const closeInProgressRef = useRef(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [ghostLabel, setGhostLabel] = useState('');

  useEffect(() => {
    if (!contextMenu) return;
    if (state.contentTabs.some((tab) => tab.filePath === contextMenu.filePath)) return;
    setContextMenu(null);
  }, [contextMenu, state.contentTabs]);

  useEffect(() => {
    const finishPointerDrag = () => {
      draggedTabPathRef.current = null;
      setDraggedTabPath(null);
    };
    document.addEventListener('pointerup', finishPointerDrag);
    document.addEventListener('pointercancel', finishPointerDrag);
    return () => {
      document.removeEventListener('pointerup', finishPointerDrag);
      document.removeEventListener('pointercancel', finishPointerDrag);
    };
  }, []);

  useEffect(() => () => {
    closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    closeTimersRef.current = [];
    closeInProgressRef.current = false;
  }, []);

  const commitTabClose = useCallback((filePaths: string[], commitClose: () => void) => {
    if (closeInProgressRef.current || filePaths.length === 0) return;

    const prefersReducedMotion = typeof window === 'undefined'
      || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')
      || (typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (prefersReducedMotion) {
      commitClose();
      return;
    }

    const renderedPaths = filePaths.filter((filePath) => {
      const element = tabElementsRef.current.get(filePath);
      if (!element) return false;
      const measuredWidth = Math.max(
        element.getBoundingClientRect().width,
        element.offsetWidth,
      );
      if (measuredWidth <= 0) return false;
      element.style.setProperty('--content-tab-close-width', `${measuredWidth}px`);
      return true;
    });

    if (renderedPaths.length === 0) {
      commitClose();
      return;
    }

    closeInProgressRef.current = true;
    setClosingTabPaths(new Set(renderedPaths));
    setClosingPhase('fade');

    const fadeTimer = window.setTimeout(() => {
      setClosingPhase('collapse');
      const collapseTimer = window.setTimeout(() => {
        setClosingTabPaths(new Set());
        setClosingPhase('idle');
        closeInProgressRef.current = false;
        closeTimersRef.current = [];
        commitClose();
      }, CONTENT_TAB_CLOSE_COLLAPSE_MS);
      closeTimersRef.current.push(collapseTimer);
    }, CONTENT_TAB_CLOSE_FADE_MS);
    closeTimersRef.current = [fadeTimer];
  }, []);

  const requestTabClose = useCallback((filePaths: string[], commitClose: () => void) => {
    if (closeInProgressRef.current || filePaths.length === 0) return;
    guardUnsavedChanges(filePaths, () => commitTabClose(filePaths, commitClose));
  }, [commitTabClose, guardUnsavedChanges]);

  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction) => {
      if (!contextMenu) return;
      switch (action) {
        case "openInBrowser":
          if (!openLocalFileInBrowser(bridge, contextMenu.filePath)) {
            window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', {
              detail: t.previewActions.openError,
            }));
          }
          break;
        case "toggleHtmlDocumentView": {
          const tab = state.contentTabs.find((item) => item.filePath === contextMenu.filePath);
          if (tab) {
            const current = tab.htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
            setContentTabHtmlPreview(tab.filePath, !current);
          }
          break;
        }
        case "openLocation":
          if (supportsShellLocation(state.appRuntime)) {
            requestShellLocation(bridge, contextMenu.filePath, 'open-parent-directory');
          }
          break;
        case "openInSplit": {
          const replacedPath = state.splitView?.enabled ? state.splitView.secondary.filePath : null;
          const open = () => openInSplit(contextMenu.filePath);
          if (replacedPath && replacedPath !== contextMenu.filePath) {
            const session = state.documentSessions?.[documentSessionKey(replacedPath)];
            if (session && isDocumentDirty(session)) {
              guardUnsavedChanges([replacedPath], open);
              break;
            }
          }
          open();
          break;
        }
        case "moveToOtherPane":
          moveToOtherPane(contextMenu.filePath);
          break;
        case "swapPanes":
          swapSplitPanes();
          break;
        case "closeSplit":
          closeSplitView();
          break;
        case "closeThisTab":
          requestTabClose([contextMenu.filePath], () => closeContentTab(contextMenu.filePath));
          break;
        case "closeTabsToRight": {
          const targetIndex = state.contentTabs.findIndex((tab) => tab.filePath === contextMenu.filePath);
          requestTabClose(
            state.contentTabs.slice(targetIndex + 1).map((tab) => tab.filePath),
            () => closeContentTabsToRight(contextMenu.filePath),
          );
          break;
        }
        case "closeOtherTabs":
          requestTabClose(
            state.contentTabs.filter((tab) => tab.filePath !== contextMenu.filePath).map((tab) => tab.filePath),
            () => closeOtherContentTabs(contextMenu.filePath),
          );
          break;
        case "closeAllTabs":
          requestTabClose(
            state.contentTabs.map((tab) => tab.filePath),
            closeAllContentTabs,
          );
          break;
      }
    },
    [
      bridge,
      closeAllContentTabs,
      closeContentTab,
      closeContentTabsToRight,
      closeOtherContentTabs,
      closeSplitView,
      contextMenu,
      guardUnsavedChanges,
      moveToOtherPane,
      openInSplit,
      requestTabClose,
      setContentTabHtmlPreview,
      state.appRuntime,
      state.contentTabs,
      state.documentSessions,
      state.settings.defaultHtmlPreview,
      state.splitView?.enabled,
      state.splitView?.secondary.filePath,
      swapSplitPanes,
      t?.previewActions?.openError,
    ],
  );

  useEffect(() => {
    const handleRequestedClose = (event: Event) => {
      const detail = (event as CustomEvent<ContentTabCloseRequest>).detail;
      if (!detail) return;
      event.preventDefault();
      switch (detail.action) {
        case 'closeThisTab':
          requestTabClose([detail.filePath], () => closeContentTab(detail.filePath));
          break;
        case 'closeTabsToRight': {
          const targetIndex = state.contentTabs.findIndex((tab) => tab.filePath === detail.filePath);
          if (targetIndex < 0) return;
          requestTabClose(
            state.contentTabs.slice(targetIndex + 1).map((tab) => tab.filePath),
            () => closeContentTabsToRight(detail.filePath),
          );
          break;
        }
        case 'closeOtherTabs':
          requestTabClose(
            state.contentTabs.filter((tab) => tab.filePath !== detail.filePath).map((tab) => tab.filePath),
            () => closeOtherContentTabs(detail.filePath),
          );
          break;
        case 'closeAllTabs':
          requestTabClose(state.contentTabs.map((tab) => tab.filePath), closeAllContentTabs);
          break;
      }
    };
    window.addEventListener(CONTENT_TAB_CLOSE_REQUEST_EVENT, handleRequestedClose);
    return () => window.removeEventListener(CONTENT_TAB_CLOSE_REQUEST_EVENT, handleRequestedClose);
  }, [
    closeAllContentTabs,
    closeContentTab,
    closeContentTabsToRight,
    closeOtherContentTabs,
    requestTabClose,
    state.contentTabs,
  ]);

  if (!state.settings.fileTabs || state.contentTabs.length === 0) return null;

  const contextMenuTabIndex = contextMenu
    ? state.contentTabs.findIndex((tab) => tab.filePath === contextMenu.filePath)
    : -1;
  const contextMenuItems = buildContentTabContextMenuItems(state, t, contextMenuTabIndex);

  return (
    <div className="content-tabs-wrap">
      <div
        ref={tabsScrollRef}
        className="content-tabs"
        role="tablist"
        aria-label={t.fileTabs}
        onScroll={updateScrollbarMetrics}
      >
        {state.contentTabs.map((tab) => {
          const active = state.activeContentTabPath === tab.filePath;
          const label = state.settings.showTitle ? tab.title || tab.fileName : tab.fileName;
          const session = state.documentSessions?.[documentSessionKey(tab.filePath)];
          const dirty = session ? isDocumentDirty(session) : false;
          const closePhaseClass = closingTabPaths.has(tab.filePath)
            ? closingPhase === 'collapse' ? ' is-closing--collapse' : ' is-closing--fade'
            : '';
          return <ContentTabItem key={tab.filePath} tab={tab} active={active} label={label}
            closePhaseClass={closePhaseClass} dragged={draggedTabPath === tab.filePath}
            closeLabel={t.tooltips.closeTab} dirty={dirty} dirtyLabel={editorT.unsavedChanges}
            draggedTabPathRef={draggedTabPathRef}
            didDragRef={didDragRef} ghostRef={ghostRef} tabElementsRef={tabElementsRef}
            onSetDraggedPath={setDraggedTabPath} onSetGhostLabel={setGhostLabel}
            onReorder={reorderContentTabs} onActivate={activateContentTab}
            onOpenContextMenu={setContextMenu}
            onClose={(path) => requestTabClose([path], () => closeContentTab(path))} />;
        })}
      </div>
      {scrollbarMetrics.visible && (
        <div
          ref={scrollbarTrackRef}
          className={`content-tabs__scrollbar${isScrollbarDragging ? " is-dragging" : ""}`}
          aria-hidden="true"
          onPointerDown={handleScrollbarTrackPointerDown}
        >
          <div
            ref={scrollbarThumbRef}
            className="content-tabs__scrollbar-thumb"
            onPointerDown={beginScrollbarDrag}
          />
        </div>
      )}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          ariaLabel={t.tabContextMenu.menuLabel}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}
      {draggedTabPath && (
        <div
          ref={ghostRef}
          className="tab-drag-ghost"
        >
          {ghostLabel}
        </div>
      )}
    </div>
  );
}