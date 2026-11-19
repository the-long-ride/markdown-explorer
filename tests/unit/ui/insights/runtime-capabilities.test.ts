import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppRuntime } from '../../../../ui/src/types/settings';
import { supportsWorkspaceInsights } from '../../../../ui/src/insights/runtimeCapabilities';

type WebWindow = Window & { __webBus?: EventTarget };

describe('Workspace Insights runtime capabilities', () => {
  const webWindow = window as WebWindow;

  beforeEach(() => {
    delete webWindow.__webBus;
  });

  afterEach(() => {
    delete webWindow.__webBus;
  });

  it('keeps Workspace Insights enabled for web runtime with __webBus', () => {
    webWindow.__webBus = new EventTarget();

    expect(supportsWorkspaceInsights('web')).toBe(true);
  });

  it('keeps Workspace Insights enabled for web runtime without __webBus', () => {
    expect(supportsWorkspaceInsights('web')).toBe(true);
  });

  it.each(['desktop', 'tauri'] as AppRuntime[])('keeps Workspace Insights enabled for %s', (runtime) => {
    expect(supportsWorkspaceInsights(runtime)).toBe(true);
  });

  it('disables Workspace Insights for the VS Code extension', () => {
    expect(supportsWorkspaceInsights('vscode')).toBe(false);
  });
});
