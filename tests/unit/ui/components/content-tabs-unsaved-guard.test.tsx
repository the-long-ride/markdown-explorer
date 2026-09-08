import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentTabs } from '../../../../ui/src/components/Content/ContentTabs';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';

const closeContentTab = vi.fn();
const guardUnsavedChanges = vi.fn();
let commitGuardedClose: (() => void) | null = null;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      settings: { language: 'en', fileTabs: true, showTitle: false, defaultHtmlPreview: false },
      contentTabs: [{
        filePath: '/docs/a.md', relativePath: 'a.md', fileName: 'a.md', title: 'A',
        contentHtml: '<p>A</p>', markdownSource: '# A', frontmatter: {}, toc: [], previewInfo: null,
      }],
      activeContentTabPath: '/docs/a.md',
      documentSessions: {},
      splitView: createSplitViewState('/docs/a.md'),
      appRuntime: 'web',
    },
    activateContentTab: vi.fn(),
    reorderContentTabs: vi.fn(),
    closeContentTab,
    closeContentTabsToRight: vi.fn(),
    closeOtherContentTabs: vi.fn(),
    closeAllContentTabs: vi.fn(),
    guardUnsavedChanges,
    setContentTabHtmlPreview: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    fileTabs: 'File tabs',
    tooltips: { closeTab: 'Close tab' },
    previewActions: { openError: 'Open error' },
    tabContextMenu: {
      closeThisTab: 'Close', closeTabsToRight: 'Close to right', closeOtherTabs: 'Close others',
      closeAllTabs: 'Close all', showInFileExplorer: 'Show in File Explorer', openInFinder: 'Open in Finder',
      revealInFinder: 'Reveal in Finder', showInFileManager: 'Show in File Manager',
    },
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn() }),
}));

vi.mock('../../../../ui/src/components/Content/useContentTabsScrollbar', () => ({
  useContentTabsScrollbar: () => ({
    tabsScrollRef: { current: null }, scrollbarTrackRef: { current: null }, scrollbarThumbRef: { current: null },
    scrollbarMetrics: { visible: false, thumbWidth: 0, thumbLeft: 0 }, isScrollbarDragging: false,
    updateScrollbarMetrics: vi.fn(), beginScrollbarDrag: vi.fn(), handleScrollbarTrackPointerDown: vi.fn(),
  }),
}));

describe('ContentTabs unsaved close guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commitGuardedClose = null;
    guardUnsavedChanges.mockImplementation((_paths: string[], commit: () => void) => {
      commitGuardedClose = commit;
    });
  });

  it('does not start the close until the unsaved guard commits', () => {
    render(<ContentTabs />);

    fireEvent.click(screen.getByRole('button', { name: 'Close tab' }));

    expect(guardUnsavedChanges).toHaveBeenCalledWith(['/docs/a.md'], expect.any(Function));
    expect(closeContentTab).not.toHaveBeenCalled();

    commitGuardedClose?.();
    expect(closeContentTab).toHaveBeenCalledWith('/docs/a.md');
  });
});
