import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Content } from '../../../../ui/src/components/Content/Content';
import { useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { getEditorUiTranslations } from '../../../../ui/src/contexts/editorUiTranslations';
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

const filePath = '/docs/guide.md';
const source = 'Alpha';
const mockSetWorkingDocumentSource = vi.fn();
const mockSaveDocument = vi.fn();

function makeState() {
  const session = setDocumentEditMode(
    createEditableDocumentSession(filePath, source, 'rev-1'),
    'inline-edit',
  );

  return {
    fileList: [{ path: 'docs/guide.md', fsPath: filePath, name: 'guide.md' }],
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
    tocCollapsed: true,
    contentHtml: '<p data-mdn-source-start="0" data-mdn-source-end="5" data-mdn-bookmark-kind="text">Alpha</p>',
    markdownSource: source,
    sourceDocumentText: null,
    currentHtmlPreviewOverride: undefined,
    frontmatter: {},
    toc: [],
    relativePath: 'guide.md',
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

describe('Content inline Markdown mode integration', () => {
  it('opens a source-backed rendered block and applies to the shared working copy without saving', async () => {
    const editorT = getEditorUiTranslations('en');
    render(<Content onImageClick={vi.fn()} scrollRef={{ current: null }} />);

    const editTrigger = await screen.findByRole('button', { name: editorT.inlineEdit });
    fireEvent.click(editTrigger);

    const editor = await screen.findByRole('textbox', { name: editorT.inlineSourceLabel });
    expect(editor).toHaveValue('Alpha');

    fireEvent.change(editor, { target: { value: 'Beta' } });
    fireEvent.click(screen.getByRole('button', { name: editorT.apply }));

    expect(mockSetWorkingDocumentSource).toHaveBeenCalledWith(filePath, 'Beta');
    expect(mockSaveDocument).not.toHaveBeenCalled();
  });
});
