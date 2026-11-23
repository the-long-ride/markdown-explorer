import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFileDropOpen } from '../../../../ui/src/hooks/useFileDropOpen';

const fire = (name: string, detail?: unknown) => act(() => { window.dispatchEvent(new CustomEvent(name, { detail })); });

describe('useFileDropOpen tauri and reset events', () => {
  it('tracks tauri drag state and opens dropped paths', () => {
    const openDroppedPath = vi.fn();
    const { result, unmount } = renderHook(() => useFileDropOpen({ isDesktop: true, modalOpen: false, openDroppedPath }));
    fire('markdown-explorer-tauri-file-drop-state', { type: 'over' });
    expect(result.current.isDragging).toBe(true);
    fire('markdown-explorer-tauri-file-drop-state', { type: 'leave' });
    expect(result.current.isDragging).toBe(false);
    fire('markdown-explorer-tauri-file-drop-state', { type: 'over' });
    fire('markdown-explorer-tauri-file-drop-state', { type: 'other' });
    expect(result.current.isDragging).toBe(true);
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(result.current.isDragging).toBe(false);
    fire('markdown-explorer-tauri-file-drop-state', { type: 'over' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.isDragging).toBe(false);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    fire('markdown-explorer-tauri-file-drop-state', { type: 'over' });
    act(() => { document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: document.body })); });
    expect(result.current.isDragging).toBe(true);
    act(() => { document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })); });
    expect(result.current.isDragging).toBe(false);
    fire('markdown-explorer-tauri-file-drop', ['/a.md']);
    fire('markdown-explorer-tauri-file-drop', 'bad');
    expect(openDroppedPath).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores tauri events while a modal is open and when not desktop', () => {
    const openDroppedPath = vi.fn();
    const { result } = renderHook(() => useFileDropOpen({ isDesktop: true, modalOpen: true, openDroppedPath }));
    fire('markdown-explorer-tauri-file-drop-state', { type: 'over' });
    fire('markdown-explorer-tauri-file-drop', ['/a.md']);
    expect(result.current.isDragging).toBe(false);
    expect(openDroppedPath).not.toHaveBeenCalled();
    const web = renderHook(() => useFileDropOpen({ isDesktop: false, modalOpen: false, openDroppedPath }));
    fire('markdown-explorer-tauri-file-drop', ['/b.md']);
    expect(web.result.current.isDragging).toBe(false);
    expect(openDroppedPath).not.toHaveBeenCalled();
  });
});
