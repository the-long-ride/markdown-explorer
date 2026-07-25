import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { getTranslations } from "../../contexts/translations";
import {
  TabContextMenu,
  type TabContextMenuAction,
} from "../shared/TabContextMenu";
import { CloseIcon } from "../shared/icons";
import { useCssVars } from "../../utils/useCssVars";
import { getEnabledShortcut } from "../../utils/shortcuts";
import {
  CONTENT_TAB_CLOSE_REQUEST_EVENT,
  type ContentTabCloseRequest,
} from "./contentTabCloseEvents";

const SCROLLBAR_TRACK_INLINE_INSET = 16;
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
  } = useAppState();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarThumbRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    maxScrollLeft: number;
    maxThumbLeft: number;
  } | null>(null);
  const [scrollbarMetrics, setScrollbarMetrics] = useState({
    visible: false,
    thumbLeft: 0,
    thumbWidth: 0,
  });
  useCssVars(scrollbarThumbRef, {
    '--scrollbar-thumb-width': `${scrollbarMetrics.thumbWidth}px`,
    '--scrollbar-thumb-left': `${scrollbarMetrics.thumbLeft}px`,
  });
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);
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
  const [ghostLabel, setGhostLabel] = useState<string>("");

  const updateScrollbarMetrics = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScrollLeft <= 1) {
      setScrollbarMetrics((current) =>
        current.visible ? { visible: false, thumbLeft: 0, thumbWidth: 0 } : current,
      );
      return;
    }

    const track = scrollbarTrackRef.current;
    const trackWidth =
      track?.clientWidth ?? Math.max(0, el.clientWidth - SCROLLBAR_TRACK_INLINE_INSET);
    const thumbWidth = Math.min(
      trackWidth,
      Math.max(44, (el.clientWidth / el.scrollWidth) * trackWidth),
    );
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft =
      maxThumbLeft === 0 ? 0 : (el.scrollLeft / maxScrollLeft) * maxThumbLeft;

    setScrollbarMetrics((current) => {
      const next = {
        visible: true,
        thumbLeft,
        thumbWidth,
      };
      if (
        current.visible === next.visible &&
        Math.abs(current.thumbLeft - next.thumbLeft) < 0.5 &&
        Math.abs(current.thumbWidth - next.thumbWidth) < 0.5
      ) {
        return current;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const handle = requestAnimationFrame(updateScrollbarMetrics);
    return () => cancelAnimationFrame(handle);
  }, [state.activeContentTabPath, state.contentTabs, updateScrollbarMetrics]);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateScrollbarMetrics)
        : null;
    resizeObserver?.observe(el);

    window.addEventListener("resize", updateScrollbarMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateScrollbarMetrics);
    };
  }, [updateScrollbarMetrics]);

  const beginScrollbarDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = tabsScrollRef.current;
      const track = scrollbarTrackRef.current;
      if (!el || !track || !scrollbarMetrics.visible) return;

      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      const maxThumbLeft = Math.max(0, track.clientWidth - scrollbarMetrics.thumbWidth);
      if (maxScrollLeft <= 0 || maxThumbLeft <= 0) return;

      scrollbarDragRef.current = {
        startX: event.clientX,
        startScrollLeft: el.scrollLeft,
        maxScrollLeft,
        maxThumbLeft,
      };
      setIsScrollbarDragging(true);
      event.preventDefault();
      event.stopPropagation();
    },
    [scrollbarMetrics.thumbWidth, scrollbarMetrics.visible],
  );

  const handleScrollbarTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = tabsScrollRef.current;
      const track = scrollbarTrackRef.current;
      if (!el || !track || !scrollbarMetrics.visible) return;

      const trackRect = track.getBoundingClientRect();
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      const maxThumbLeft = Math.max(0, track.clientWidth - scrollbarMetrics.thumbWidth);
      if (maxScrollLeft <= 0 || maxThumbLeft <= 0) return;

      const nextThumbLeft = Math.min(
        maxThumbLeft,
        Math.max(0, event.clientX - trackRect.left - scrollbarMetrics.thumbWidth / 2),
      );
      el.scrollLeft = (nextThumbLeft / maxThumbLeft) * maxScrollLeft;
      updateScrollbarMetrics();
      beginScrollbarDrag(event);
    },
    [
      beginScrollbarDrag,
      scrollbarMetrics.thumbWidth,
      scrollbarMetrics.visible,
      updateScrollbarMetrics,
    ],
  );

  useEffect(() => {
    if (!isScrollbarDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const el = tabsScrollRef.current;
      const drag = scrollbarDragRef.current;
      if (!el || !drag) return;

      const deltaX = event.clientX - drag.startX;
      const nextScrollLeft =
        drag.startScrollLeft + (deltaX / drag.maxThumbLeft) * drag.maxScrollLeft;
      el.scrollLeft = Math.min(drag.maxScrollLeft, Math.max(0, nextScrollLeft));
      updateScrollbarMetrics();
    };

    const handlePointerUp = () => {
      scrollbarDragRef.current = null;
      setIsScrollbarDragging(false);
      updateScrollbarMetrics();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isScrollbarDragging, updateScrollbarMetrics]);

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

  const requestTabClose = useCallback((filePaths: string[], commitClose: () => void) => {
    if (closeInProgressRef.current || filePaths.length === 0) return;

    const prefersReducedMotion = typeof window === 'undefined'
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
        1,
      );
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

  const handleContextMenuAction = useCallback(
    (action: TabContextMenuAction) => {
      if (!contextMenu) return;
      switch (action) {
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
      closeAllContentTabs,
      closeContentTab,
      closeContentTabsToRight,
      closeOtherContentTabs,
      contextMenu,
      requestTabClose,
      state.contentTabs,
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
          const closePhaseClass = closingTabPaths.has(tab.filePath)
            ? closingPhase === 'collapse'
              ? ' is-closing--collapse'
              : ' is-closing--fade'
            : '';
          return (
            <div
              key={tab.filePath}
              ref={(element) => {
                if (element) tabElementsRef.current.set(tab.filePath, element);
                else tabElementsRef.current.delete(tab.filePath);
              }}
              className={`content-tab${active ? " is-active" : ""}${draggedTabPath === tab.filePath ? " is-dragging" : ""}${closePhaseClass}`}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              title={tab.relativePath}
              onPointerDown={(event) => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('.content-tab__close')) return;
                draggedTabPathRef.current = tab.filePath;
                didDragRef.current = false;
                setDraggedTabPath(tab.filePath);
                setGhostLabel(label);

                const handlePointerMove = (moveEvent: PointerEvent) => {
                  if (ghostRef.current) {
                    ghostRef.current.style.transform = `translate3d(${moveEvent.clientX + 10}px, ${moveEvent.clientY + 10}px, 0)`;
                    ghostRef.current.style.display = 'flex';
                  }
                };

                document.addEventListener('pointermove', handlePointerMove);

                const cleanUpMove = () => {
                  document.removeEventListener('pointermove', handlePointerMove);
                  document.removeEventListener('pointerup', cleanUpMove);
                  document.removeEventListener('pointercancel', cleanUpMove);
                  if (ghostRef.current) {
                    ghostRef.current.style.display = 'none';
                  }
                };
                document.addEventListener('pointerup', cleanUpMove);
                document.addEventListener('pointercancel', cleanUpMove);
              }}
              onPointerEnter={() => {
                if (draggedTabPathRef.current && draggedTabPathRef.current !== tab.filePath) {
                  reorderContentTabs(draggedTabPathRef.current, tab.filePath);
                  didDragRef.current = true;
                }
              }}
              onClick={(event) => {
                if (didDragRef.current) {
                  event.preventDefault();
                  didDragRef.current = false;
                  return;
                }
                activateContentTab(tab.filePath);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({
                  filePath: tab.filePath,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                activateContentTab(tab.filePath);
              }}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                requestTabClose([tab.filePath], () => closeContentTab(tab.filePath));
              }}
            >
              <span className="content-tab__label">{label}</span>
              <button
                type="button"
                className="content-tab__close"
                aria-label={t.tooltips.closeTab}
                title={t.tooltips.closeTab}
                onClick={(event) => {
                  event.stopPropagation();
                  requestTabClose([tab.filePath], () => closeContentTab(tab.filePath));
                }}
              >
                <CloseIcon size={11} />
              </button>
            </div>
          );
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
          labels={t.tabContextMenu}
          shortcuts={{
            closeThisTab: getEnabledShortcut(state.settings, 'closeContentTab'),
            closeTabsToRight: getEnabledShortcut(state.settings, 'closeContentTabsToRight'),
            closeOtherTabs: getEnabledShortcut(state.settings, 'closeOtherContentTabs'),
            closeAllTabs: getEnabledShortcut(state.settings, 'closeAllContentTabs'),
          }}
          disabled={{
            closeThisTab: contextMenuTabIndex === -1,
            closeTabsToRight:
              contextMenuTabIndex === -1 ||
              contextMenuTabIndex >= state.contentTabs.length - 1,
            closeOtherTabs: state.contentTabs.length <= 1,
            closeAllTabs: state.contentTabs.length === 0,
          }}
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
