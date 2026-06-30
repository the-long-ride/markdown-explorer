import { describe, expect, test } from 'vitest';

import {
  createStartupReadyAck,
  deferWorkspaceLoad,
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
