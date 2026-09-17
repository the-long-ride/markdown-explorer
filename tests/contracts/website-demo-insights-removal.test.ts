import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('website demo Workspace Insights boundary', () => {
  it('does not load the Insights host adapter while Chromium still does', () => {
    const webRouter = read('website-app/src/web-file-utility-router.ts');
    const chromeRouter = read('chromium-xtension/src/chrome-host-search.ts');

    expect(webRouter).not.toContain('web-insights-host');
    expect(webRouter).not.toContain('handleWebInsightsHostCommand');
    expect(chromeRouter).toContain('handleBrowserInsightsHostCommand');
  });

  it('keeps the explicit website-demo marker available before UI bootstrap', () => {
    expect(read('website-app/src/web-host.ts')).toContain('__webDemoBus');
    expect(read('ui/src/insights/runtimeCapabilities.ts')).toContain('isWebsiteDemoRuntime');
  });

  it('gates every shared Workspace Insights presentation entry point', () => {
    for (const file of [
      'ui/src/AppView.tsx',
      'ui/src/components/Topbar/Topbar.tsx',
      'ui/src/components/Settings/SettingsPreferencesPanel.tsx',
      'ui/src/components/Settings/SettingsModal.tsx',
      'ui/src/useAppLayoutEffects.ts',
    ]) {
      expect(read(file), file).toContain('supportsWorkspaceInsights');
    }
  });

  it('documents website-demo Insights removal and browser Scope View support', () => {
    const websiteRuntime = read('docs/instructions/04-runtimes/05-website-demo-file-mode.md');
    const chromiumRuntime = read('docs/instructions/04-runtimes/04-chromium-extension.md');
    const parity = read('docs/instructions/04-runtimes/06-runtime-parity.md');
    const readme = read('README.md');

    expect(websiteRuntime).toMatch(/Workspace Insights.*(?:unavailable|not available)/i);
    expect(websiteRuntime).toContain('Scope View');
    expect(chromiumRuntime).toMatch(/Workspace Insights.*(?:supported|available|retained)/i);
    expect(parity).toMatch(/Workspace Insights/);
    expect(parity).toContain('Scope View document modal');
    expect(readme).toContain('Scope View Modal');
  });
});
