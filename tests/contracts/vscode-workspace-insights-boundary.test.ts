import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (relativePath: string) => readFile(resolve(root, relativePath), 'utf8');

describe('VS Code Workspace Insights boundary', () => {
  test('keeps Workspace Insights out of the VS Code host bridge', async () => {
    const source = await read('vscode/src/fonts/panelFontBridge.ts');

    // Workspace Insights is Desktop-only. The VS Code package must not create
    // scanners/watchers for a feature that the extension does not expose.
    expect(source).not.toContain('createPanelInsightsHost');
    expect(source).not.toContain('createInsightsExternalHost');
    expect(source).not.toContain('scanInsightsWorkspace');
    expect(source).not.toContain('setInsightsWatchState');
  });

  test('does not expose Workspace Insights in the VS Code UI or shortcut path', async () => {
    const [appView, topbar, tabBar, settings, actions, layout, keybindings, ignoreRules] = await Promise.all([
      read('ui/src/AppView.tsx'),
      read('ui/src/components/Topbar/Topbar.tsx'),
      read('ui/src/components/Desktop/DesktopTabBar.tsx'),
      read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
      read('ui/src/components/Settings/settingsActions.ts'),
      read('ui/src/useAppLayoutEffects.ts'),
      read('ui/src/contexts/appStateConstants.ts'),
      read('vscode/.vscodeignore'),
    ]);

    expect(appView).toContain("const WorkspaceInsightsEntry = lazy(() => import(\"./components/Insights/WorkspaceInsightsEntry\")");
    expect(appView).toContain('supportsWorkspaceInsights(state.appRuntime) && state.settings.insightsEnabled');
    expect(topbar).toContain('showInsights=');
    expect(topbar).toContain('supportsWorkspaceInsights(state.appRuntime)');
    expect(tabBar).toContain('showInsights={supportsWorkspaceInsights(state.appRuntime) && state.settings.insightsEnabled}');
    expect(settings).toContain('supportsWorkspaceInsights(state.appRuntime) && (');
    expect(actions).toContain("{ id: 'toggleWorkspaceInsights', label: 'Toggle workspace insights panel', scope: 'desktop' }");
    expect(layout).toContain('supportsWorkspaceInsights(state.appRuntime) && state.settings.insightsEnabled');
    expect(keybindings).toContain("delete normalized.toggleWorkspaceInsights");
    expect(ignoreRules).toContain('out/vscode/src/core/panelInsights.js');
    expect(ignoreRules).toContain('out/vscode/src/core/panelInsightsExternal.js');
    expect(ignoreRules).toContain('ui/dist/assets/WorkspaceInsightsEntry.js');
    expect(ignoreRules).toContain('ui/dist/assets/insights.worker-*.js');
    expect(ignoreRules).not.toContain('ui/dist/assets/workspaceInsightsSession.js');
  });
});
