import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppRuntime } from '../../../../ui/src/types/settings';
import { supportsWorkspaceInsights } from '../../../../ui/src/insights/runtimeCapabilities';

type WebDemoWindow = Window & { __webDemoBus?: EventTarget };

describe('Workspace Insights runtime capabilities', () => {
  const webWindow = window as WebDemoWindow;

  beforeEach(() => {
    delete webWindow.__webDemoBus;
  });

  afterEach(() => {
    delete webWindow.__webDemoBus;
  });

  it('disables Workspace Insights for the website demo marker', () => {
    webWindow.__webDemoBus = new EventTarget();

    expect(supportsWorkspaceInsights('chrome')).toBe(false);
  });

  it('keeps Workspace Insights enabled for the Chromium extension', () => {
    expect(supportsWorkspaceInsights('chrome')).toBe(true);
  });

  it.each(['desktop', 'tauri'] as AppRuntime[])('keeps Workspace Insights enabled for %s', (runtime) => {
    expect(supportsWorkspaceInsights(runtime)).toBe(true);
  });

  it('disables Workspace Insights for the VS Code extension', () => {
    expect(supportsWorkspaceInsights('vscode')).toBe(false);
  });
});
