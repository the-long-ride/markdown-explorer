import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditableDocumentSession, documentSessionKey, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';

const mockAppState: any = {
  state: {},
  activateContentTab: vi.fn(),
  reorderContentTabs: vi.fn(),
  closeContentTab: vi.fn(),
  closeContentTabsToRight: vi.fn(),
  closeOtherContentTabs: vi.fn(),
  closeAllContentTabs: vi.fn(),
  setContentTabHtmlPreview: vi.fn(),
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => mockAppState,
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn() }),
}));

vi.mock('../../../../ui/src/components/Content/useContentTabsScrollbar', () => ({
  useContentTabsScrollbar: () => ({
    tabsScrollRef: { current: null },
    scrollbarTrackRef: { current: null },
    scrollbarThumbRef: { current: null },
    scrollbarMetrics: { visible: false },
    isScrollbarDragging: false,
    updateScrollbarMetrics: vi.fn(),
    beginScrollbarDrag: vi.fn(),
    handleScrollbarTrackPointerDown: vi.fn(),
  }),
}));

import { ContentTabs } from '../../../../ui/src/components/Content/ContentTabs';

describe('ContentTabs dirty document sessions', () => {
  beforeEach(() => {
    const filePath = '/docs/a.md';
    const session = replaceWorkingSource(
      createEditableDocumentSession(filePath, '# A', 'rev-1'),
      '# B',
    );
    mockAppState.state = {
      settings: {
        language: 'en',
        fileTabs: true,
        showTitle: false,
        defaultHtmlPreview: false,
      },
      appRuntime: 'vscode',
      activeContentTabPath: filePath,
      contentTabs: [{
        filePath,
        relativePath: 'docs/a.md',
        fileName: 'a.md',
        title: 'A',
        contentHtml: '<h1>B</h1>',
        markdownSource: '# B',
        sourceDocumentText: null,
        frontmatter: {},
        toc: [],
        previewInfo: null,
      }],
      documentSessions: { [documentSessionKey(filePath)]: session },
      splitView: createSplitViewState(filePath),
    };
  });

  it('derives the unsaved indicator from the shared document session', () => {
    render(<ContentTabs />);

    expect(screen.getByLabelText('Unsaved changes')).toHaveTextContent('●');
  });
});
