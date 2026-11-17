import type { ReactNode } from 'react';
import { HistoryIcon } from '../shared/icons';

const svg = (path: ReactNode, viewBox = '0 0 24 24') => (
  <svg width="15" height="15" viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export function AppearanceRowIcon({ id }: { id: string }) {
  switch (id) {
    case 'colorMode':
      return svg(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
        </>
      );
    case 'desktopView':
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 3v18" />
        </>
      );
    case 'tableAlignment':
      return svg(
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="10" y1="4" x2="10" y2="20" />
        </>
      );
    default:
      return svg(<circle cx="12" cy="12" r="9" />);
  }
}

export function FeatureRowIcon({ id }: { id: string }) {
  switch (id) {
    case 'sidebar-labels':
      return svg(
        <>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </>
      );
    case 'file-tabs':
      return svg(
        <>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 9h20M9 4v5" />
        </>
      );
    case 'history-sidebar-enabled':
      return <HistoryIcon size={15} />;
    case 'max-pinned-items':
      return svg(
        <>
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14l-2-6V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7l-2 6z" />
        </>
      );
    case 'bookmarks-enabled':
      return svg(<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />);
    case 'insights-enabled':
      return svg(
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <path d="M8.5 7.5l2.5 7.5M15.5 7.5l-2.5 7.5" />
        </>
      );
    case 'markdown-editing-enabled':
      return svg(
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </>
      );
    case 'document-conversion':
      return svg(
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m10 13 2 2 2-2M12 11v4" />
        </>
      );
    case 'html-preview':
      return svg(
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </>
      );
    case 'allow-upstream-html-preview':
      return svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
    case 'html-code-block-preview':
      return svg(
        <>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </>
      );
    case 'csv-preview':
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </>
      );
    default:
      return svg(<circle cx="12" cy="12" r="3" />);
  }
}

export function TypographyRoleIcon({ role }: { role: string }) {
  switch (role) {
    case 'appUi':
    case 'ui':
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </>
      );
    case 'body':
    case 'document':
      return svg(
        <>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="14" y2="18" />
        </>
      );
    case 'heading':
      return svg(<path d="M6 5v14M18 5v14M6 12h12" />);
    case 'quote':
      return svg(<path d="M4 5v14M9 7h11M9 12h11M9 17h7" />);
    case 'code':
      return svg(
        <>
          <polyline points="7 8 3 12 7 16" />
          <polyline points="17 8 21 12 17 16" />
          <line x1="14" y1="4" x2="10" y2="20" />
        </>
      );
    case 'mermaid':
      return svg(
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="9" y="15" width="6" height="6" rx="1" />
          <path d="M6 9v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9M12 14v1" />
        </>
      );
    case 'math':
      return svg(<path d="M19 4H5l6 8-6 8h14" />);
    default:
      return svg(<path d="M4 7V4h16v3M9 20h6M12 4v16" />);
  }
}

export function ShortcutActionIcon({ actionId }: { actionId: string }) {
  switch (actionId) {
    case 'welcome':
      return svg(<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
    case 'workspaceSelection':
      return svg(
        <>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </>
      );
    case 'back':
      return svg(<path d="M19 12H5M12 19l-7-7 7-7" />);
    case 'forward':
      return svg(<path d="M5 12h14M12 5l7 7-7 7" />);
    case 'locateFile':
      return svg(
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </>
      );
    case 'openCurrentDocumentLocation':
      return svg(
        <>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <polyline points="15 13 18 10 21 13" />
        </>
      );
    case 'refresh':
      return svg(
        <>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </>
      );
    case 'findCurrentFile':
    case 'searchCurrent':
      return svg(
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
    case 'searchAllTabs':
      return svg(
        <>
          <circle cx="10" cy="10" r="7" />
          <line x1="21" y1="21" x2="15" y2="15" />
          <path d="M19 8h2M19 12h2" />
        </>
      );
    case 'toggleSidebar':
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </>
      );
    case 'openFiles':
      return svg(<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />);
    case 'openBookmarks':
      return svg(<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />);
    case 'toggleToc':
      return svg(
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="7" y1="12" x2="21" y2="12" />
          <line x1="11" y1="18" x2="21" y2="18" />
        </>
      );
    case 'toggleWorkspaceInsights':
      return svg(
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <path d="M8.5 7.5l2.5 7.5M15.5 7.5l-2.5 7.5" />
        </>
      );
    case 'toggleFocusMode':
      return svg(
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        </>
      );
    case 'sidebarCursorMode':
      return svg(<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />);
    case 'toggleDesktopViewMode':
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </>
      );
    case 'toggleHtmlPreview':
      return svg(
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </>
      );
    case 'zoomIn':
      return svg(
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </>
      );
    case 'zoomOut':
      return svg(
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </>
      );
    case 'resetZoom':
      return svg(
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <circle cx="11" cy="11" r="2" />
        </>
      );
    case 'collapseAll':
      return svg(
        <>
          <polyline points="17 11 12 6 7 11" />
          <polyline points="17 18 12 13 7 18" />
        </>
      );
    case 'expandAll':
      return svg(
        <>
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </>
      );
    case 'closeContentTab':
    case 'closeOtherContentTabs':
    case 'closeContentTabsToRight':
    case 'closeAllContentTabs':
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </>
      );
    case 'saveCurrentDocument':
      return svg(
        <>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </>
      );
    case 'editCurrentDocument':
    case 'plainEditCurrentDocument':
      return svg(
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </>
      );
    case 'settings':
      return svg(
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      );
    case 'toggleTheme':
      return svg(
        <>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </>
      );
    case 'editorBold': return svg(<><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></>);
    case 'editorItalic': return svg(<path d="M19 5h-9M14 19H5M15 5 9 19" />);
    case 'editorUnderline': return svg(<path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16" />);
    case 'editorQuote': return svg(<path d="M4 5v14M9 7h11M9 12h11M9 17h7" />);
    case 'editorInlineCode': return svg(<path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />);
    case 'editorCodeBlock': return svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m10 9-3 3 3 3M14 9l3 3-3 3" /></>);
    case 'editorLink': return svg(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>);
    case 'editorBulletList': return svg(<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />);
    case 'editorNumberedList': return svg(<path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M4 9h2M6 19H4c0-1 2-2 2-3s-1-1.5-2-1" />);
    case 'editorTaskList': return svg(<><path d="m3 6 2 2 4-4M13 6h8M13 17h8" /><rect x="3" y="14" width="6" height="6" rx="1" /></>);
    case 'editorDecreaseFontSize': return svg(<path d="M4 19 8.5 6h1L14 19M5.5 15h7M16 13h5" />);
    case 'editorIncreaseFontSize': return svg(<path d="M4 19 8.5 6h1L14 19M5.5 15h7M18 10v6M15 13h6" />);
    default:
      return svg(
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <line x1="7" y1="15" x2="17" y2="15" />
        </>
      );
  }
}
