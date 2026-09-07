import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Topbar } from '../../../../ui/src/components/Topbar/Topbar';
import { useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { useNavigation } from '../../../../ui/src/contexts/NavigationContext';
import { usePlatform } from '../../../../ui/src/contexts/PlatformContext';
import {
  createEditableDocumentSession,
  documentSessionKey,
  replaceWorkingSource,
} from '../../../../ui/src/editor/documentSession';

vi.mock('../../../../ui/src/contexts/AppStateContext');
vi.mock('../../../../ui/src/contexts/NavigationContext');
vi.mock('../../../../ui/src/contexts/PlatformContext');
vi.mock('../../../../ui/src/components/shared/HeaderActionGroups', () => ({
  DocumentHeaderActions: () => null,
  NavigationHeaderActions: () => null,
}));
vi.mock('../../../../ui/src/components/shared/ToolbarActionMenu', () => ({
  ToolbarActionMenu: () => null,
}));
vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ tooltip, icon, ...props }: any) => (
    <button aria-label={tooltip} {...props}>{icon}</button>
  ),
}));
vi.mock('../../../../ui/src/components/shared/icons', () => ({
  EditIcon: () => <span />,
}));
vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({ default: 'logo.png' }));

const filePath = '/docs/guide.md';
const mockSetDocumentEditMode = vi.fn();
const mockSaveDocument = vi.fn();

function editableState({ dirty = true, writable = true }: { dirty?: boolean; writable?: boolean } = {}) {
  const base = createEditableDocumentSession(filePath, '# A', 'rev-1');
  const session = dirty ? replaceWorkingSource(base, '# B') : base;
  return {
    theme: 'light',
    isMaximized: false,
    relativePath: 'guide.md',
    currentFile: filePath,
    appRuntime: 'desktop',
    workspacePath: '/docs',
    workspaceName: 'docs',
    settings: {
      language: 'en',
      keybindings: { editCurrentDocument: 'Ctrl+E' },
      insightsEnabled: false,
    },
    sidebarCollapsed: false,
    tocCollapsed: true,
    focusMode: false,
    toc: [],
    defaultExpanded: true,
    recentWorkspaces: [],
    documentSessions: { [documentSessionKey(filePath)]: session },
    contentTabs: [{
      filePath,
      documentWrite: writable
        ? { supported: true, revision: 'rev-1' }
        : { supported: false, revision: null, reason: 'permission-required' },
    }],
  } as any;
}

function setup(state = editableState()) {
  vi.mocked(useAppState).mockReturnValue({
    state,
    navigate: vi.fn(),
    openInEditor: vi.fn(),
    refresh: vi.fn(),
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleToc: vi.fn(),
    toggleFocusMode: vi.fn(),
    dispatch: vi.fn(),
    setDocumentEditMode: mockSetDocumentEditMode,
    saveDocument: mockSaveDocument,
  } as any);
  vi.mocked(useNavigation).mockReturnValue({
    back: vi.fn(), forward: vi.fn(), canGoBack: false, canGoForward: false,
  } as any);
  vi.mocked(usePlatform).mockReturnValue({ postMessage: vi.fn() } as any);

  return render(
    <Topbar
      onSettingsOpen={vi.fn()}
      onExportOpen={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
      onCopyFile={vi.fn()}
    />,
  );
}

describe('Topbar Markdown editing controls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('switches an editable Markdown document between rendered, inline edit, and plain modes', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(mockSetDocumentEditMode).toHaveBeenCalledWith(filePath, 'plain');

    fireEvent.click(screen.getByRole('button', { name: 'Inline Edit' }));
    expect(mockSetDocumentEditMode).toHaveBeenCalledWith(filePath, 'inline-edit');

    fireEvent.click(screen.getByRole('button', { name: 'Rendered' }));
    expect(mockSetDocumentEditMode).toHaveBeenCalledWith(filePath, 'rendered');
  });

  it('enables Save only for a dirty writable document session', () => {
    const { rerender } = setup(editableState({ dirty: true, writable: true }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mockSaveDocument).toHaveBeenCalledWith(filePath);

    vi.mocked(useAppState).mockReturnValue({
      ...(useAppState() as any),
      state: editableState({ dirty: false, writable: true }),
    });
    rerender(
      <Topbar
        onSettingsOpen={vi.fn()}
        onExportOpen={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
        onCopyFile={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('does not expose in-app editing controls without an editable Markdown session', () => {
    setup({ ...editableState(), currentFile: '/docs/image.png', documentSessions: {} });
    expect(screen.queryByRole('button', { name: 'Plain' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inline Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rendered' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
