import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { attachContentScrollHandler, attachScrollFlushOnHide, syncStickyTableHeaders } from "./contentUtils";
import { installMermaidContentLifecycle } from "./mermaidContentLifecycle";
import { scheduleContentEnhancements } from "./scheduleContentEnhancements";
import { applyPreviewActionTranslations, type PreviewActionLabels } from "../../dom/htmlPreviewActions";
import type { HeadingSectionState } from "./enhancements/headingSectionState";
import { getWorkspaceScopeKey } from "../../contexts/contentTabState";
import { createDocumentClickHandler } from "./documentClickHandler";
import { createDocumentContextMenuHandler } from "./documentContextMenuHandler";
import type { DocumentInteractionCallbacks, DocumentInteractionDocument } from "./documentInteractionTypes";
import {
  createScrollPersistHandler,
  createTrackedHeadingSections,
  restoreScrollPosition,
  useReadingProgressPersistence,
} from "./useReadingProgressPersistence";

export interface DocumentScrollMemory {
  positions: MutableRefObject<Record<string, number>>;
  lastFileRef: MutableRefObject<string | null>;
  lastVersionRef: MutableRefObject<number | null>;
}

export interface DocumentInteractionArgs extends DocumentInteractionCallbacks {
  state: any;
  document: DocumentInteractionDocument;
  bodyRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  bridge: any;
  previewLabels: PreviewActionLabels;
  scrollMemory?: DocumentScrollMemory;
}

// Post-render wiring for one rendered document root (main view or a split
// pane): enhancements, heading sections, click/context-menu delegation,
// sticky table headers and reading-progress persistence.
export function useDocumentInteractions({
  state,
  document: doc,
  bodyRef,
  scrollRef,
  bridge,
  previewLabels,
  scrollMemory,
  onImageClick,
  navigate,
  onOpenHtmlModal,
  onOpenLinkMenu,
  onBookmarkContextMenu,
  onActionError,
}: DocumentInteractionArgs) {
  const workspaceKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const { rememberHeadingsFor } = useReadingProgressPersistence(workspaceKey);
  const mermaidRunIdRef = useRef(0);
  const lastMermaidAppearanceKeyRef = useRef<string | null>(null);
  const headingStateByFileRef = useRef<Map<string, HeadingSectionState>>(new Map());

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || doc.disabled) return;

    const headingSections = createTrackedHeadingSections({
      body,
      currentFile: doc.filePath,
      defaultExpanded: state.defaultExpanded !== false,
      stateByFile: headingStateByFileRef.current,
      workspaceKey,
      onPersist: rememberHeadingsFor,
    });

    applyPreviewActionTranslations(body, previewLabels);

    const callbacks = { onImageClick, navigate, onOpenHtmlModal, onOpenLinkMenu, onBookmarkContextMenu, onActionError };
    const handleContextMenu = createDocumentContextMenuHandler({ body, filePath: doc.filePath, callbacks });

    const scrollContainer = scrollRef.current;
    const persistScroll = createScrollPersistHandler(scrollRef, workspaceKey, doc.filePath);
    const handleScroll = () => { syncStickyTableHeaders(scrollContainer); persistScroll.persist(); };
    const detachScrollHandler = attachContentScrollHandler(scrollContainer, handleScroll);
    const detachScrollFlushOnHide = attachScrollFlushOnHide(persistScroll.flush);

    const handleClick = createDocumentClickHandler({
      body, filePath: doc.filePath, appRuntime: state.appRuntime, bridge, previewLabels, headingSections, callbacks,
    });
    body.addEventListener("click", handleClick);
    body.addEventListener("contextmenu", handleContextMenu);

    const startEnhancements = () => scheduleContentEnhancements({
      body, state, scrollRef, handleScroll, mermaidRunIdRef,
    });
    const disposeMermaidLifecycle = installMermaidContentLifecycle({
      body,
      scroll: scrollContainer,
      state,
      previousAppearanceKeyRef: lastMermaidAppearanceKeyRef,
      runIdRef: mermaidRunIdRef,
      startEnhancements,
    });
    if (scrollMemory) {
      restoreScrollPosition({
        scrollRef, positions: scrollMemory.positions.current, workspaceKey,
        currentFile: doc.filePath, renderVersion: doc.renderVersion,
        lastFileRef: scrollMemory.lastFileRef, lastVersionRef: scrollMemory.lastVersionRef,
      });
    }

    return () => {
      disposeMermaidLifecycle();
      body.removeEventListener("click", handleClick);
      body.removeEventListener("contextmenu", handleContextMenu);
      headingSections.dispose();
      detachScrollHandler?.(); detachScrollFlushOnHide?.();
      persistScroll.flush();
    };
  }, [doc.renderVersion, doc.filePath, doc.disabled, doc.rootId, state.theme, state.themeStyle,
    state.settings.activeCustomThemeId, state.settings.customThemes, state.settings.fontBindings,
    onImageClick, navigate, scrollRef, bridge, previewLabels, onOpenHtmlModal, onOpenLinkMenu,
    onBookmarkContextMenu, onActionError, state.appRuntime, state.defaultExpanded]);
}
