import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import { AppStateContext } from '../../../../ui/src/contexts/AppStateContext';
import { WorkspaceSelection } from '../../../../ui/src/components/Workspace/WorkspaceSelection';

const mockBridge = {
  postMessage: vi.fn(),
  onMessage: vi.fn(() => () => {}),
  getState: vi.fn(() => ({})),
  setState: vi.fn(),
};

const mockAppState: any = {
  state: {
    theme: 'light',
    isMaximized: false,
    recentWorkspaces: [],
    settings: { language: 'en', keybindings: {} },
    hostPlatform: 'windows',
    sidebarCollapsed: false,
    tocCollapsed: true,
    focusMode: false,
    currentFile: null,
    toc: [],
    workspaceName: '',
  },
  dispatch: vi.fn(),
  toggleTheme: vi.fn(),
  openInEditor: vi.fn(),
  toggleToc: vi.fn(),
  toggleFocusMode: vi.fn(),
};

describe('WorkspaceSelection in Web (/markdown-explorer/app/)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Open Folder, Open File, and New Virtual Workspace buttons when __webBus is present without ?mode=web', () => {
    (window as any).__webBus = new EventTarget();
    delete (window as any).electronAPI;

    render(
      createElement(
        AppStateContext.Provider,
        { value: mockAppState },
        createElement(
          PlatformProvider,
          { bridge: mockBridge as any },
          createElement(WorkspaceSelection),
        ),
      ),
    );

    const openFolderBtn = screen.getByRole('button', { name: /open folder/i });
    expect(openFolderBtn).toBeInTheDocument();

    const openFileBtn = screen.getByRole('button', { name: /open file/i });
    expect(openFileBtn).toBeInTheDocument();

    const virtualWsBtn = screen.getByTestId('create-virtual-workspace-btn');
    expect(virtualWsBtn).toBeInTheDocument();

    fireEvent.click(openFileBtn);
    expect(mockBridge.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'openFile' }),
    );

    fireEvent.click(virtualWsBtn);
    expect(mockBridge.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'createVirtualWorkspace' }),
    );

    delete (window as any).__webBus;
  });
});
