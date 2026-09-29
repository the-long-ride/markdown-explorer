import { resolveRenderedLink } from "../../dom/linkContextMenu";
import type { DocumentInteractionCallbacks } from "./documentInteractionTypes";
import { findDocumentMediaTarget } from "./documentMediaTarget";

interface DocumentContextMenuContext {
  body: HTMLElement;
  filePath: string | null;
  callbacks: DocumentInteractionCallbacks;
}

export function createDocumentContextMenuHandler({
  body, filePath, callbacks,
}: DocumentContextMenuContext): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    if (callbacks.onBookmarkContextMenu?.(event)) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href], a[data-mdn-target]");
    const media = findDocumentMediaTarget(event.target);
    const imageTarget = media && body.contains(media) ? media : null;

    const validAnchor = anchor && body.contains(anchor) ? anchor : null;
    if (!validAnchor && !imageTarget) return;

    event.preventDefault();
    event.stopPropagation();
    callbacks.onOpenLinkMenu({
      x: event.clientX,
      y: event.clientY,
      anchor: validAnchor ?? undefined,
      bookmarkTarget: event.target.closest('[data-mdn-bookmark-kind="image"], [data-mdn-bookmark-kind="mermaid"]') ?? validAnchor ?? imageTarget,
      link: validAnchor ? resolveRenderedLink(validAnchor, filePath || "") : undefined,
      imageTarget: imageTarget ?? undefined,
    });
  };
}
