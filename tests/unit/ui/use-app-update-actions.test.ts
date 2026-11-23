import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppUpdateActions } from '../../../ui/src/useAppUpdateActions';

function setup(over: Record<string, any> = {}) {
  const bridge: any = { postMessage: vi.fn() };
  const { result } = renderHook(() => useAppUpdateActions({ bridge, canInstallUpdates: true, canInstallUpdate: true, downloadUrl: 'https://d', latestVersion: '2', changelogUrl: 'https://c', ...over }));
  return { bridge, a: result.current };
}

describe('useAppUpdateActions', () => {
  it('downloads in-app when installable and schedules/restarts updates', () => {
    const { bridge, a } = setup();
    a.downloadUpdate();
    a.scheduleUpdateOnExit();
    a.restartAndApplyUpdate();
    a.openUpdateChangelog();
    expect(bridge.postMessage.mock.calls.map((c: any[]) => c[0].command)).toEqual(['downloadUpdate', 'scheduleDownloadedUpdate', 'restartAndApplyUpdate', 'openExternal']);
  });

  it('falls back to opening the download url and ignores install actions when not installable', () => {
    const { bridge, a } = setup({ canInstallUpdates: false, changelogUrl: '' });
    a.downloadUpdate();
    a.scheduleUpdateOnExit();
    a.restartAndApplyUpdate();
    a.openUpdateChangelog();
    a.openExternalUrl('');
    expect(bridge.postMessage.mock.calls).toEqual([[{ command: 'openExternal', url: 'https://d' }]]);
    const none = setup({ canInstallUpdate: false, downloadUrl: '' });
    none.a.downloadUpdate();
    expect(none.bridge.postMessage).not.toHaveBeenCalled();
  });
});
