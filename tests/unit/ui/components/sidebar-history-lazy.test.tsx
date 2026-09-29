import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../../../ui/src/components/Sidebar/Sidebar';

const panelModule = vi.hoisted(() => ({ loaded: false }));

let mockState: any;

function baseState(sidebarActiveTab: string) {
  return {
    sidebarActiveTab,
    sidebarCollapsed: false,
    workspacePath: '/docs',
    workspaceName: 'Docs',
    settings: { language: 'en', scopeFocus: {}, keybindings: {}, defaultHtmlPreview: true, historySidebarEnabled: true },
    currentFile: null,
    contentTabs: [],
    appRuntime: 'electron',
    hostPlatform: 'unknown',
    fileList: [],
    tree: { name: 'Docs', path: '/docs', files: [], children: [] },
  };
}

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn(), onMessage: vi.fn(() => () => {}) }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState, dispatch: vi.fn(), updateSettings: vi.fn(), navigate: vi.fn() }),
}));

vi.mock('../../../../ui/src/contexts/RepositorySnapshotContext', () => ({
  useRepositorySnapshot: () => ({
    state: { activePath: null },
    repositoryView: { mode: 'live' },
    revisionWorkspace: null,
    openSnapshotFile: vi.fn(),
    searchRevision: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/components/Sidebar/SidebarSearch', () => ({
  SidebarSearch: () => <div data-testid="sidebar-search" />,
}));

vi.mock('../../../../ui/src/components/History/RepositoryHistoryPanel', () => {
  panelModule.loaded = true;
  return {
    RepositoryHistoryPanel: ({ visible }: { visible: boolean }) => <div data-testid="lazy-history-panel" data-visible={String(visible)} />,
  };
});

describe('Sidebar History tab lazy loading', () => {
  it('does not load the History panel module until the History tab is opened', async () => {
    mockState = baseState('files');
    const { rerender } = render(<Sidebar />);
    await Promise.resolve();
    expect(panelModule.loaded).toBe(false);
    expect(screen.queryByTestId('lazy-history-panel')).toBeNull();

    mockState = baseState('history');
    rerender(<Sidebar />);

    expect(await screen.findByTestId('lazy-history-panel')).toHaveAttribute('data-visible', 'true');
    expect(panelModule.loaded).toBe(true);

    mockState = baseState('files');
    rerender(<Sidebar />);
    expect(screen.getByTestId('lazy-history-panel')).toHaveAttribute('data-visible', 'false');
  });
});
