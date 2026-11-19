import { afterEach, describe, expect, it } from 'vitest';
import { getWorkspaceEntryCapability, isWebDemoTestMode } from '../../../../ui/src/workspace/workspaceEntryCapability';

describe('getWorkspaceEntryCapability', () => {
  it.each([
    ['desktop', 'trash'], ['tauri', 'trash'], ['vscode', 'trash'], ['web', 'permanent'],
  ] as const)('%s deletes with %s', (runtime, mode) => {
    expect(getWorkspaceEntryCapability(runtime, true)).toEqual({ create: true, deleteMode: mode });
  });
  it('disables everything without a workspace', () => {
    expect(getWorkspaceEntryCapability('desktop', false)).toEqual({ create: false, deleteMode: null });
  });
});

describe('isWebDemoTestMode', () => {
  afterEach(() => {
    delete (window as { __webBus?: EventTarget }).__webBus;
    window.history.pushState({}, '', '/');
  });
  it('is false outside the web runtime', () => {
    expect(isWebDemoTestMode()).toBe(false);
  });
  it('is true in web test mode and false in web mode', () => {
    (window as { __webBus?: EventTarget }).__webBus = new EventTarget();
    expect(isWebDemoTestMode()).toBe(false);
    window.history.pushState({}, '', '/?mode=web');
    expect(isWebDemoTestMode()).toBe(false);
    window.history.pushState({}, '', '/?mode=test');
    expect(isWebDemoTestMode()).toBe(true);
  });
});
