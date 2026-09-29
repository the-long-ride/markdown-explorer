import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';

const closeContentTab = vi.fn();
const guardUnsavedChanges = vi.fn();
let guardedCommit: (() => void) | null = null;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      settings: { fileTabs: true, language: 'en', showTitle: false, defaultHtmlPreview: true },
      contentTabs: [{
        filePath: '/docs/a.md', relativePath: 'a.md', fileName: 'a.md', title: 'A',
        contentHtml: '', markdownSource: '# A', frontmatter: {}, toc: [], previewInfo: null,
      }],
      activeContentTabPath: '/docs/a.md',
      documentSessions: {},
      splitView: createSplitViewState('/docs/a.md'),
      appRuntime: 'vscode',
      hostPlatform: 'unknown',
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

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn() }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    fileTabs: 'File tabs',
    tooltips: { closeTab: 'Close tab' },
    previewActions: { openError: 'Open failed' },
    tabContextMenu: { menuLabel: 'Tab menu' },
  }),
}));

vi.mock('../../../../ui/src/components/Content/useContentTabsScrollbar', () => ({
  useContentTabsScrollbar: () => ({
    tabsScrollRef: { current: null }, scrollbarTrackRef: { current: null }, scrollbarThumbRef: { current: null },
    scrollbarMetrics: { visible: false }, isScrollbarDragging: false,
    updateScrollbarMetrics: vi.fn(), beginScrollbarDrag: vi.fn(), handleScrollbarTrackPointerDown: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/components/Content/ContentTabItem', () => ({
  ContentTabItem: ({ tab, onClose }: any) => (
    <button type="button" onClick={() => onClose(tab.filePath)}>Close a.md</button>
  ),
}));

vi.mock('../../../../ui/src/components/shared/TabContextMenu', () => ({ TabContextMenu: () => null }));
vi.mock('../../../../ui/src/components/Content/contentTabContextMenuItems', () => ({
  buildContentTabContextMenuItems: () => [],
}));

import { ContentTabs } from '../../../../ui/src/components/Content/ContentTabs';

describe('ContentTabs unsaved guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardedCommit = null;
    guardUnsavedChanges.mockImplementation((_paths: string[], commit: () => void) => {
      guardedCommit = commit;
    });
  });

  it('defers tab close until the shared unsaved guard commits', () => {
    render(<ContentTabs />);
    fireEvent.click(screen.getByRole('button', { name: 'Close a.md' }));

    expect(guardUnsavedChanges).toHaveBeenCalledWith(['/docs/a.md'], expect.any(Function));
    expect(closeContentTab).not.toHaveBeenCalled();

    act(() => guardedCommit?.());
    expect(closeContentTab).toHaveBeenCalledWith('/docs/a.md');
  });
});
