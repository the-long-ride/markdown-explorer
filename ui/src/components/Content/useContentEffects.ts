import { useRef } from "react";
import { useContentNavigationEffects } from "./useContentNavigationEffects";
import { useContentScrollMemory } from "./useContentScrollMemory";
import type { PreviewActionLabels } from "../../dom/htmlPreviewActions";
import type { LinkContextMenuState } from "../shared/LinkContextMenu";
import { getWorkspaceScopeKey } from "../../contexts/contentTabState";
import { useReadingProgressPersistence } from "./useReadingProgressPersistence";
import { useDocumentInteractions } from "./useDocumentInteractions";

interface ContentEffectsArgs {
  state: any;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onImageClick: (el: HTMLElement) => void;
  navigate: (path: string) => void;
  push: (path: string) => void;
  bridge: any;
  previewLabels: PreviewActionLabels;
  onOpenHtmlModal: (documentHtml: string, trigger: HTMLElement) => void;
  onOpenLinkMenu: (state: LinkContextMenuState) => void;
  onBookmarkContextMenu?: (event: MouseEvent) => boolean;
  onActionError: (message: string) => void;
}

// Main (single) document view: history push, global markdown source, scroll
// memory across file switches, plus the shared root-scoped interactions.
export function useContentEffects({
  state,
  bodyRef,
  scrollRef,
  onImageClick,
  navigate,
  push,
  bridge,
  previewLabels,
  onOpenHtmlModal,
  onOpenLinkMenu,
  onBookmarkContextMenu,
  onActionError,
}: ContentEffectsArgs) {
  const workspaceKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const { handleScrollCaptured } = useReadingProgressPersistence(workspaceKey);

  const scrollPositionsRef = useContentScrollMemory(state.currentFile, scrollRef, handleScrollCaptured);
  const lastRestoredFileRef = useRef<string | null>(null);
  const lastRestoredVersionRef = useRef<number | null>(null);

  useContentNavigationEffects({
    currentFile: state.currentFile,
    markdownSource: state.markdownSource,
    navigate,
    push,
  });

  useDocumentInteractions({
    state,
    document: {
      rootId: "main",
      filePath: state.currentFile,
      renderVersion: state.renderVersion,
      disabled: Boolean(state.isLoading || state.notFoundHref || state.workspaceUnavailablePath),
    },
    bodyRef,
    scrollRef,
    bridge,
    previewLabels,
    scrollMemory: { positions: scrollPositionsRef, lastFileRef: lastRestoredFileRef, lastVersionRef: lastRestoredVersionRef },
    onImageClick,
    navigate,
    onOpenHtmlModal,
    onOpenLinkMenu,
    onBookmarkContextMenu,
    onActionError,
  });
}
