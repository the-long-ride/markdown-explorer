import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Content } from '../../../../ui/src/components/Content/Content';
import { useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { useNavigation } from '../../../../ui/src/contexts/NavigationContext';
import { usePlatform } from '../../../../ui/src/contexts/PlatformContext';
import {
  createEditableDocumentSession,
  documentSessionKey,
  setDocumentEditMode,
} from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';

vi.mock('../../../../ui/src/contexts/AppStateContext');
vi.mock('../../../../ui/src/contexts/NavigationContext');
vi.mock('../../../../ui/src/contexts/PlatformContext');
vi.mock('../../../../ui/src/contexts/HistoryContext', () => ({
  useHistoryView: () => ({ historyViews: {}, clearHistoryView: vi.fn() }),
}));
vi.mock('../../../../ui/src/components/Content/useContentEffects', () => ({
  useContentEffects: vi.fn(),
}));
vi.mock('../../../../ui/src/components/Content/useBookmarkSelection', () => ({
  useBookmarkSelection: () => ({
    bookmarkSelection: null,
    closeBookmarkSelection: vi.fn(),
    handleBookmarkContextMenu: vi.fn(),
    openBookmarkDialogForElement: vi.fn(() => false),
  }),
}));
vi.mock('../../../../ui/src/components/Modal/HtmlPreviewModal', () => ({ HtmlPreviewModal: () => null }));
vi.mock('../../../../ui/src/components/Modal/ScopeViewModal', () => ({ ScopeViewModal: () => null }));
vi.mock('../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu', () => ({ BookmarkSelectionMenu: () => null }));

const mockSetWorkingDocumentSource = vi.fn();
const mockSaveDocument = vi.fn();

function makeState() {
  const filePath = '/docs/empty.md';
  const session = setDocumentEditMode(
    createEditableDocumentSession(filePath, '', 'rev-1'),
    'plain',
  );

  return {
    fileList: [{ path: 'docs/empty.md', fsPath: filePath, name: 'empty.md' }],
    tree: null,
    currentFile: filePath,
    theme: 'light' as const,
    hasThemePreference: false,
    themeStyle: 'default' as const,
    hasThemeStylePreference: false,
    defaultExpanded: true,
    workspaceName: 'test',
    workspacePath: '/docs',
    sidebarCollapsed: false,
    tocCollapsed: false,
    contentHtml: '',
    markdownSource: '',
    sourceDocumentText: null,
    currentHtmlPreviewOverride: undefined,
    frontmatter: {},
    toc: [],
    relativePath: 'empty.md',
    isLoading: false,
    isWorkspaceScanning: false,
    loadingLabel: '',
    loadingDetail: '',
    previewInfo: null,
    staleContentFilePath: null,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    settings: {
      language: 'en',
      keybindings: {},
      desktopViewMode: 'focus',
      documentConversion: false,
      defaultHtmlPreview: false,
      bookmarksEnabled: false,
    },
    renderVersion: 1,
    contentTabs: [],
    activeContentTabPath: null,
    splitView: createSplitViewState(filePath),
    recentWorkspaces: [],
    documentSessions: { [documentSessionKey(filePath)]: session },
    isMaximized: false,
    appVersion: '1.0.0',
    appRuntime: 'web' as const,
    hostPlatform: 'web' as const,
    hostArch: 'x64',
    focusMode: false,
    updateState: { status: 'idle' },
    sidebarActiveTab: 'files' as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppState).mockReturnValue({
    state: makeState(),
    navigate: vi.fn(),
    refresh: vi.fn(),
    updateSettings: vi.fn(),
    setWorkingDocumentSource: mockSetWorkingDocumentSource,
    saveDocument: mockSaveDocument,
  } as any);
  vi.mocked(useNavigation).mockReturnValue({ push: vi.fn() } as any);
  vi.mocked(usePlatform).mockReturnValue({
    postMessage: vi.fn(),
    copyToClipboard: vi.fn(),
  } as any);
});

describe('Content plain Markdown mode integration', () => {
  it('keeps an empty Markdown file editable and routes edits and save through the shared session API', () => {
    render(<Content onImageClick={vi.fn()} scrollRef={{ current: null }} />);

    const editor = screen.getByRole('textbox', { name: 'Markdown source' });
    expect(editor).toHaveValue('');

    fireEvent.change(editor, { target: { value: '# New' } });
    expect(mockSetWorkingDocumentSource).toHaveBeenCalledWith('/docs/empty.md', '# New');

    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });
    expect(mockSaveDocument).toHaveBeenCalledWith('/docs/empty.md');
  });
});
