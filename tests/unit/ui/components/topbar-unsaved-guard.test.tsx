import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Topbar } from '../../../../ui/src/components/Topbar/Topbar';
import { useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { useNavigation } from '../../../../ui/src/contexts/NavigationContext';
import { usePlatform } from '../../../../ui/src/contexts/PlatformContext';
import { createEditableDocumentSession, documentSessionKey, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';

vi.mock('../../../../ui/src/contexts/AppStateContext');
vi.mock('../../../../ui/src/contexts/NavigationContext');
vi.mock('../../../../ui/src/contexts/PlatformContext');
vi.mock('../../../../ui/src/components/shared/HeaderActionGroups', () => ({
  DocumentHeaderActions: () => null,
  NavigationHeaderActions: () => null,
}));
vi.mock('../../../../ui/src/components/shared/ToolbarActionMenu', () => ({ ToolbarActionMenu: () => null }));
vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ tooltip, icon, ...props }: any) => <button aria-label={tooltip} {...props}>{icon}</button>,
}));
vi.mock('../../../../ui/src/components/shared/icons', () => ({ EditIcon: () => <span /> }));
vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({ default: 'logo.png' }));

const filePath = '/docs/a.md';
const postMessage = vi.fn();
const guardUnsavedChanges = vi.fn();
let guardedCommit: (() => void) | null = null;

function setup(runtime: 'desktop' | 'tauri' = 'desktop') {
  const dirty = replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B');
  vi.mocked(useAppState).mockReturnValue({
    state: {
      theme: 'light', isMaximized: false, relativePath: 'a.md', currentFile: filePath,
      appRuntime: runtime, workspacePath: '/docs', workspaceName: 'docs',
      settings: { language: 'en', keybindings: {}, insightsEnabled: false },
      sidebarCollapsed: false, tocCollapsed: true, focusMode: false, toc: [], defaultExpanded: true,
      recentWorkspaces: [], documentSessions: { [documentSessionKey(filePath)]: dirty },
      contentTabs: [{ filePath, documentWrite: { supported: true, revision: '1:3' } }],
    },
    navigate: vi.fn(), openInEditor: vi.fn(), refresh: vi.fn(), toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(), toggleToc: vi.fn(), toggleFocusMode: vi.fn(), dispatch: vi.fn(),
    setDocumentEditMode: vi.fn(), saveDocument: vi.fn(), guardUnsavedChanges,
  } as any);
  vi.mocked(useNavigation).mockReturnValue({ back: vi.fn(), forward: vi.fn(), canGoBack: false, canGoForward: false } as any);
  vi.mocked(usePlatform).mockReturnValue({ postMessage } as any);
  return render(<Topbar onSettingsOpen={vi.fn()} onExportOpen={vi.fn()} onExpandAll={vi.fn()} onCollapseAll={vi.fn()} onCopyFile={vi.fn()} />);
}

describe('Topbar unsaved changes guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardedCommit = null;
    guardUnsavedChanges.mockImplementation((_paths: string[], commit: () => void) => { guardedCommit = commit; });
  });

  it('defers closing the workspace until the guard commits', () => {
    setup('desktop');
    fireEvent.click(screen.getByRole('button', { name: /close folder/i }));
    expect(guardUnsavedChanges).toHaveBeenCalledWith([filePath], expect.any(Function));
    expect(postMessage).not.toHaveBeenCalledWith({ command: 'closeWorkspace' });
    guardedCommit?.();
    expect(postMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
  });

  it('defers closing the desktop window until the guard commits', () => {
    const { container } = setup('tauri');
    const closeButton = container.querySelector<HTMLButtonElement>('.window-control-btn--close');
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton!);
    expect(guardUnsavedChanges).toHaveBeenCalledWith([filePath], expect.any(Function));
    expect(postMessage).not.toHaveBeenCalledWith({ command: 'window-close' });
    guardedCommit?.();
    expect(postMessage).toHaveBeenCalledWith({ command: 'window-close' });
  });
});
