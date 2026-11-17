import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportsWorkspaceInsights } from '../../ui/src/insights/runtimeCapabilities';

const repoRoot = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('web runtime Workspace Insights boundary and support', () => {
  it('loads the Insights host adapter in the web runtime', () => {
    const webRouter = read('website-app/src/web-file-utility-router.ts');
    const webInsightsHost = read('website-app/src/web-insights-host.ts');

    expect(webRouter).toContain('web-insights-host');
    expect(webRouter).toContain('handleWebInsightsHostCommand');
    expect(webInsightsHost).toContain('handleBrowserInsightsHostCommand');
  });

  it('keeps the explicit web bus marker available before UI bootstrap', () => {
    expect(read('website-app/src/web-host.ts')).toContain('__webBus');
    expect(read('ui/src/insights/runtimeCapabilities.ts')).toContain('isWebRuntime');
  });

  it('supports Workspace Insights across web runtimes with and without __webBus', () => {
    const originalWindow = globalThis.window;
    try {
      (globalThis as any).window = undefined;
      expect(supportsWorkspaceInsights('web')).toBe(true);

      (globalThis as any).window = { __webBus: new EventTarget() };
      expect(supportsWorkspaceInsights('web')).toBe(true);
      expect(supportsWorkspaceInsights('electron')).toBe(true);
      expect(supportsWorkspaceInsights('vscode')).toBe(false);
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it('gates every shared Workspace Insights presentation entry point', () => {
    for (const file of [
      'ui/src/AppView.tsx',
      'ui/src/components/Topbar/Topbar.tsx',
      'ui/src/components/Settings/SettingsFeaturesSection.tsx',
      'ui/src/components/Settings/SettingsModal.tsx',
      'ui/src/useAppLayoutEffects.ts',
    ]) {
      expect(read(file), file).toContain('supportsWorkspaceInsights');
    }
  });

  it('documents browser Scope View and Workspace Insights support', () => {
    const websiteRuntime = read('docs/instructions/04-runtimes/05-website-demo-file-mode.md');
    const parity = read('docs/instructions/04-runtimes/06-runtime-parity.md');
    const readme = read('README.md');

    expect(websiteRuntime).toContain('Scope View');
    expect(parity).toMatch(/Workspace Insights/);
    expect(parity).toContain('Scope View document modal');
    expect(readme).toContain('Scope View Modal');
  });
});
