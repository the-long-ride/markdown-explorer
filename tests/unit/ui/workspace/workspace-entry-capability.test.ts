import { afterEach, describe, expect, it } from 'vitest';
import { getWorkspaceEntryCapability, isWebDemoTestMode } from '../../../../ui/src/workspace/workspaceEntryCapability';

describe('getWorkspaceEntryCapability', () => {
  it.each([
    ['desktop', 'trash'], ['tauri', 'trash'], ['vscode', 'trash'], ['chrome', 'permanent'],
  ] as const)('%s deletes with %s', (runtime, mode) => {
    expect(getWorkspaceEntryCapability(runtime, true)).toEqual({ create: true, deleteMode: mode });
  });
  it('disables everything without a workspace', () => {
    expect(getWorkspaceEntryCapability('desktop', false)).toEqual({ create: false, deleteMode: null });
  });
});

describe('isWebDemoTestMode', () => {
  afterEach(() => {
    delete (window as { __webDemoBus?: EventTarget }).__webDemoBus;
    window.history.pushState({}, '', '/');
  });
  it('is false outside the website demo', () => {
    expect(isWebDemoTestMode()).toBe(false);
  });
  it('is true in the demo test mode and false in its file mode', () => {
    (window as { __webDemoBus?: EventTarget }).__webDemoBus = new EventTarget();
    expect(isWebDemoTestMode()).toBe(true);
    window.history.pushState({}, '', '/?mode=file');
    expect(isWebDemoTestMode()).toBe(false);
  });
});
