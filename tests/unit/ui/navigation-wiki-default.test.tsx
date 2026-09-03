import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceNavigationProvider, useNavigation } from '../../../ui/src/contexts/NavigationContext';

const { mockNavigate, mockBridge, buildCatalog } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockBridge: { postMessage: vi.fn(), onMessage: vi.fn(() => () => {}) },
  buildCatalog: vi.fn(async () => [
    { path: 'Guide.md', canonicalPath: 'Guide.md', title: 'Guide', aliases: [], anchors: ['install'] },
    { path: 'docs/Start.md', canonicalPath: 'docs/Start.md', title: 'Start', aliases: [], anchors: [] },
  ]),
}));

vi.mock('../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    navigate: mockNavigate,
    state: { workspacePath: '/workspace', workspaceName: 'workspace', fileList: [] },
  }),
}));
vi.mock('../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => mockBridge }));
vi.mock('../../../ui/src/insights/workspaceInsightsSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../ui/src/insights/workspaceInsightsSession')>();
  return { ...actual, buildLazyWorkspaceWikiCatalog: buildCatalog };
});
vi.mock('../../../ui/src/insights/settingsStore', () => ({
  INSIGHTS_SETTINGS_CHANGED_EVENT: 'markdown-explorer:workspace-insights-settings-changed',
  loadInsightsSettingsConfig: () => ({ globalDefaults: {}, workspaceOverrides: {} }),
}));

describe('default workspace wiki navigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    buildCatalog.mockClear();
  });

  it('resolves and navigates wiki links through the production workspace provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspaceNavigationProvider>{children}</WorkspaceNavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    let resolution: Awaited<ReturnType<typeof result.current.navigateWikiLink>> | undefined;
    await act(async () => {
      resolution = await result.current.navigateWikiLink('../Guide#install', 'docs/Start.md');
    });

    expect(resolution).toMatchObject({
      status: 'resolved', canonicalPath: 'Guide.md', fragment: 'install',
    });
    expect(mockNavigate).toHaveBeenCalledWith('Guide.md');
    expect(buildCatalog).toHaveBeenCalledTimes(1);
  });
});
