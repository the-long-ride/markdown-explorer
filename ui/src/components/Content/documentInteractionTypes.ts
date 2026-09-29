import type { DocumentRootId } from "../../document/activeDocumentRoot";
import type { LinkContextMenuState } from "../shared/LinkContextMenu";

export interface DocumentInteractionDocument {
  rootId: DocumentRootId;
  filePath: string | null;
  renderVersion: number;
  /** Loading, not-found or unavailable-workspace screens: nothing to wire. */
  disabled: boolean;
}

export interface DocumentInteractionCallbacks {
  onImageClick: (el: HTMLElement) => void;
  navigate: (path: string) => void;
  onOpenHtmlModal: (documentHtml: string, trigger: HTMLElement) => void;
  onOpenLinkMenu: (state: LinkContextMenuState) => void;
  onBookmarkContextMenu?: (event: MouseEvent) => boolean;
  onActionError: (message: string) => void;
}
