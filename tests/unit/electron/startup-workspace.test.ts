import { describe, expect, test } from 'vitest';

import {
  createStartupReadyAck,
  deferWorkspaceLoad,
  runDeferredLoad,
} from '../../../desktop/startup-workspace.js';

describe('startup workspace', () => {
  test('startup ready ack exposes app shell before workspace files exist', () => {
    const ack = createStartupReadyAck({
      workspacePath: 'C:/docs/project',
      recentWorkspaces: [{ name: 'Project', path: 'C:/docs/project' }],
      documentConversionEnabled: true,
      hostInfo: {
        appVersion: '1.0.0',
        appRuntime: 'desktop',
        hostPlatform: 'windows',
        hostArch: 'x64',
        isMaximized: true,
      },
    });

    expect(ack).toEqual({
      command: 'readyAck',
      fileList: [],
      tree: null,
      theme: 'dark',
      themeStyle: 'default',
      defaultExpanded: true,
      workspaceName: 'project',
      workspacePath: 'C:/docs/project',
      recentWorkspaces: [{ name: 'Project', path: 'C:/docs/project' }],
      documentConversionEnabled: true,
      appVersion: '1.0.0',
      appRuntime: 'desktop',
      hostPlatform: 'windows',
      hostArch: 'x64',
      isMaximized: true,
    });
  });

  test('startup workspace load waits for scheduler so first paint is not blocked', async () => {
    const calls: string[] = [];
    let scheduled: (() => Promise<void>) | null = null;

    deferWorkspaceLoad({
      schedule(fn: () => Promise<void>) {
        scheduled = fn;
      },
      ensureHeavyModules() {
        calls.push('heavy');
      },
      bindWorkspaceWatch() {
        calls.push('watch');
      },
      sendLoading(label: string) {
        calls.push(`loading:${label}`);
      },
      async sendWorkspaceData() {
        calls.push('workspace');
      },
      async sendInitialContent(openFirstFile: boolean) {
        calls.push(`content:${openFirstFile}`);
      },
      sendUpdateState() {
        calls.push('updates');
      },
      onError(err: Error) {
        calls.push(`error:${err.message}`);
      },
    });

    expect(calls).toEqual([]);
    expect(typeof scheduled).toBe('function');

    await scheduled!();

    expect(calls).toEqual([
      'loading:Loading workspace...',
      'heavy',
      'watch',
      'workspace',
      'content:false',
      'updates',
    ]);
  });
});

describe('runDeferredLoad', () => {
  test('calls all steps in order when no errors', async () => {
    const calls: string[] = [];
    await runDeferredLoad({
      ensureHeavyModules() { calls.push('heavy'); },
      bindWorkspaceWatch() { calls.push('watch'); },
      sendLoading(label: string) { calls.push(`loading:${label}`); },
      async sendWorkspaceData() { calls.push('workspace'); },
      async sendInitialContent(openFirstFile: boolean) { calls.push(`content:${openFirstFile}`); },
      openFirstFile: true,
      sendUpdateState() { calls.push('updates'); },
      onError() { calls.push('error'); },
    });
    expect(calls).toEqual([
      'loading:Loading workspace...',
      'heavy',
      'watch',
      'workspace',
      'content:true',
      'updates',
    ]);
  });

  test('calls onError when an error occurs', async () => {
    const errors: any[] = [];
    await runDeferredLoad({
      ensureHeavyModules() { throw new Error('heavy fail'); },
      bindWorkspaceWatch() {},
      sendLoading() {},
      async sendWorkspaceData() {},
      async sendInitialContent() {},
      onError(err: Error) { errors.push(err); },
    });
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('heavy fail');
  });

  test('skips sendUpdateState when not provided (optional chaining)', async () => {
    const calls: string[] = [];
    await runDeferredLoad({
      ensureHeavyModules() { calls.push('heavy'); },
      bindWorkspaceWatch() { calls.push('watch'); },
      sendLoading() { calls.push('loading'); },
      async sendWorkspaceData() { calls.push('workspace'); },
      async sendInitialContent() { calls.push('content'); },
      sendUpdateState: undefined as any,
      onError: undefined as any,
    });
    expect(calls).toEqual(['loading', 'heavy', 'watch', 'workspace', 'content']);
  });

  test('openFirstFile defaults to false', async () => {
    const calls: string[] = [];
    await runDeferredLoad({
      ensureHeavyModules() {},
      bindWorkspaceWatch() {},
      sendLoading() {},
      async sendWorkspaceData() {},
      async sendInitialContent(openFirstFile: boolean) { calls.push(`open:${openFirstFile}`); },
      sendUpdateState() {},
      onError() {},
    });
    expect(calls).toEqual(['open:false']);
  });
});
