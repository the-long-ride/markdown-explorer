export const CONTENT_TAB_CLOSE_REQUEST_EVENT = 'markdown-explorer:request-content-tab-close';

export type ContentTabCloseRequest =
  | { action: 'closeThisTab'; filePath: string }
  | { action: 'closeTabsToRight'; filePath: string }
  | { action: 'closeOtherTabs'; filePath: string }
  | { action: 'closeAllTabs' };

export function requestAnimatedContentTabClose(detail: ContentTabCloseRequest): boolean {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent<ContentTabCloseRequest>(CONTENT_TAB_CLOSE_REQUEST_EVENT, {
    detail,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
