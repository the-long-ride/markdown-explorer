import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFileDropOpen } from '../../../../ui/src/hooks/useFileDropOpen';

function dropEvent(handle: unknown, files: File[] = []) {
  const event = new Event('drop', { cancelable: true }) as any;
  const item = { getAsFileSystemHandle: typeof handle === 'function' ? handle : async () => handle };
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files, items: [item] } });
  return event;
}

async function drop(params: Record<string, any>, event: Event) {
  const hook = renderHook(() => useFileDropOpen({ isDesktop: false, isWeb: true, modalOpen: false, openDroppedPath: vi.fn(), ...params } as any));
  await act(async () => { window.dispatchEvent(event); await new Promise((r) => setTimeout(r, 0)); });
  hook.unmount();
}

describe('useFileDropOpen web file handles', () => {
  it('reads files from handles and routes binary single files to the handle opener', async () => {
    const openDroppedWebFiles = vi.fn();
    const openDroppedFileHandle = vi.fn();
    const text = new File(['x'], 'a.md');
    await drop({ openDroppedWebFiles, openDroppedFileHandle }, dropEvent({ kind: 'file', getFile: async () => text }));
    expect(openDroppedWebFiles).toHaveBeenCalledWith([text]);
    const binary = new File(['x'], 'README');
    await drop({ openDroppedWebFiles, openDroppedFileHandle }, dropEvent({ kind: 'file', getFile: async () => binary }));
    expect(openDroppedFileHandle).toHaveBeenCalledTimes(1);
  });

  it('falls back to the handle opener when no file can be resolved and logs handle errors', async () => {
    const openDroppedWebFiles = vi.fn();
    const openDroppedFileHandle = vi.fn();
    await drop({ openDroppedWebFiles, openDroppedFileHandle }, dropEvent({ kind: 'file' }));
    expect(openDroppedFileHandle).toHaveBeenCalledTimes(1);
    await drop({ openDroppedWebFiles }, dropEvent({ kind: 'file' }));
    expect(openDroppedWebFiles).not.toHaveBeenCalled();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await drop({ openDroppedWebFiles }, dropEvent(async () => { throw new Error('nope'); }));
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
