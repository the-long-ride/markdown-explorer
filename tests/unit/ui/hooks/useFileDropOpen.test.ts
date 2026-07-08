import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileDropOpen } from '../../../../ui/src/hooks/useFileDropOpen';

vi.mock('../../../../ui/src/desktop/desktopTabs', () => ({
  getDroppedFilePath: vi.fn(),
}));

import { getDroppedFilePath } from '../../../../ui/src/desktop/desktopTabs';

const mockGetDroppedFilePath = vi.mocked(getDroppedFilePath);

function createDataTransfer(opts: { types?: string[]; files?: any[]; items?: any[] } = {}) {
  return {
    types: opts.types ?? ['Files'],
    dropEffect: '',
    files: opts.files ?? [],
    items: opts.items ?? [],
    getData: vi.fn(),
    setData: vi.fn(),
    clearData: vi.fn(),
    setDragImage: vi.fn(),
  };
}

function createDragEvent(type: string, opts: { types?: string[]; files?: any[]; items?: any[]; relatedTarget?: EventTarget | null } = {}) {
  const dataTransfer = createDataTransfer(opts);
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  Object.defineProperty(event, 'relatedTarget', { value: opts.relatedTarget ?? null, configurable: true });
  event.preventDefault = vi.fn();
  return { event, dataTransfer };
}

interface HookProps {
  isDesktop: boolean;
  isChrome: boolean;
  isWebDemo?: boolean;
  modalOpen: boolean;
  openDroppedPath: ReturnType<typeof vi.fn>;
  openDroppedFolder?: (handle: any) => void;
  openDroppedFileHandle?: (handle: any) => void;
}

function makeProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    isDesktop: true,
    isChrome: false,
    isWebDemo: false,
    modalOpen: false,
    openDroppedPath: vi.fn(),
    openDroppedFolder: undefined,
    openDroppedFileHandle: undefined,
    ...overrides,
  };
}

describe('useFileDropOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove('is-dragging-files');
  });

  afterEach(() => {
    document.body.classList.remove('is-dragging-files');
  });

  it('returns isDragging false initially', () => {
    const props = makeProps();
    const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
    expect(result.current.isDragging).toBe(false);
  });

  it('does not attach listeners when not desktop and not chrome', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const props = makeProps({ isDesktop: false, isChrome: false });
    const { unmount } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain('dragenter');
    unmount();
    addSpy.mockRestore();
  });

  it('attaches listeners when isDesktop is true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const props = makeProps({ isDesktop: true, isChrome: false });
    const { unmount } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('dragenter');
    expect(calls).toContain('dragleave');
    expect(calls).toContain('dragover');
    expect(calls).toContain('drop');
    expect(calls).toContain('dragend');
    unmount();
    addSpy.mockRestore();
  });

  it('attaches listeners when isChrome is true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const props = makeProps({ isDesktop: false, isChrome: true });
    const { unmount } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('dragenter');
    unmount();
    addSpy.mockRestore();
  });

  it('attaches listeners when isWebDemo is true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const props = makeProps({ isDesktop: false, isChrome: false, isWebDemo: true });
    const { unmount } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('dragenter');
    expect(calls).toContain('drop');
    unmount();
    addSpy.mockRestore();
  });

  describe('isFileDrag check', () => {
    it('ignores dragenter without Files type', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('dragenter', { types: ['text/plain'] });
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(false);
    });

    it('ignores dragover without Files type', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('dragover', { types: ['text/plain'] });
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('dragenter', () => {
    it('sets isDragging true', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('dragenter');
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(true);
    });

    it('adds is-dragging-files class to body', () => {
      const props = makeProps();
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      expect(document.body.classList.contains('is-dragging-files')).toBe(true);
    });

    it('increments counter on multiple enters', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      expect(result.current.isDragging).toBe(true);
    });

    it('ignores dragenter when modalOpen is true', () => {
      const props = makeProps({ modalOpen: true });
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('dragleave', () => {
    it('resets isDragging when counter reaches 0', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      const { event } = createDragEvent('dragleave', { relatedTarget: document.body });
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(false);
    });

    it('does not reset when counter is above 0', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      const { event } = createDragEvent('dragleave', { relatedTarget: document.body });
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(true);
    });

    it('resets when relatedTarget is null even if counter > 0', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      const { event } = createDragEvent('dragleave', { relatedTarget: null });
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(false);
    });

    it('removes is-dragging-files class on reset', () => {
      const props = makeProps();
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      const { event } = createDragEvent('dragleave', { relatedTarget: document.body });
      act(() => { window.dispatchEvent(event); });
      expect(document.body.classList.contains('is-dragging-files')).toBe(false);
    });
  });

  describe('dragover', () => {
    it('prevents default', () => {
      const props = makeProps();
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('dragover');
      act(() => { window.dispatchEvent(event); });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('sets dropEffect to copy', () => {
      const props = makeProps();
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event, dataTransfer } = createDragEvent('dragover');
      act(() => { window.dispatchEvent(event); });
      expect(dataTransfer.dropEffect).toBe('copy');
    });

    it('does nothing when modalOpen is true', () => {
      const props = makeProps({ modalOpen: true });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event, dataTransfer } = createDragEvent('dragover');
      act(() => { window.dispatchEvent(event); });
      expect(dataTransfer.dropEffect).toBe('');
    });
  });

  describe('drop', () => {
    it('resets drag state', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      const { event } = createDragEvent('drop');
      act(() => { window.dispatchEvent(event); });
      expect(result.current.isDragging).toBe(false);
    });

    it('returns early when modalOpen is true after resetting state', () => {
      const props = makeProps({ modalOpen: true });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop');
      act(() => { window.dispatchEvent(event); });
      expect(props.openDroppedPath).not.toHaveBeenCalled();
    });

    it('calls openDroppedPath with result from getDroppedFilePath', () => {
      mockGetDroppedFilePath.mockReturnValue('/path/to/file.md');
      const props = makeProps();
      const file = new File([''], 'file.md', { type: '' });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [file] });
      act(() => { window.dispatchEvent(event); });
      expect(mockGetDroppedFilePath).toHaveBeenCalledWith(file);
      expect(props.openDroppedPath).toHaveBeenCalledWith('/path/to/file.md');
    });

    it('does not call openDroppedPath when no files', () => {
      const props = makeProps();
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [] });
      act(() => { window.dispatchEvent(event); });
      expect(props.openDroppedPath).not.toHaveBeenCalled();
    });

    it('does not call openDroppedPath when getDroppedFilePath returns undefined', () => {
      mockGetDroppedFilePath.mockReturnValue(undefined);
      const props = makeProps();
      const file = new File([''], 'file.md', { type: '' });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [file] });
      act(() => { window.dispatchEvent(event); });
      expect(props.openDroppedPath).not.toHaveBeenCalled();
    });

    it('chrome path: calls openDroppedFolder for directory handle', async () => {
      const handle = { kind: 'directory' };
      const getAsFileSystemHandle = vi.fn().mockResolvedValue(handle);
      const item = { getAsFileSystemHandle };
      const openDroppedFolder = vi.fn();
      const props = makeProps({ isDesktop: false, isChrome: true, openDroppedFolder });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [], items: [item] });
      act(() => { window.dispatchEvent(event); });
      await vi.waitFor(() => {
        expect(openDroppedFolder).toHaveBeenCalledWith(handle);
      });
    });

    it('chrome path: falls through if handle is not a directory', async () => {
      mockGetDroppedFilePath.mockReturnValue('/path/file.md');
      const handle = { kind: 'file' };
      const getAsFileSystemHandle = vi.fn().mockResolvedValue(handle);
      const item = { getAsFileSystemHandle };
      const openDroppedFolder = vi.fn();
      const props = makeProps({ isDesktop: false, isChrome: true, openDroppedFolder });
      const file = new File([''], 'file.md', { type: '' });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [file], items: [item] });
      act(() => { window.dispatchEvent(event); });
      await vi.waitFor(() => {
        expect(openDroppedFolder).not.toHaveBeenCalled();
        expect(props.openDroppedPath).toHaveBeenCalledWith('/path/file.md');
      });
    });

    it('chrome path: falls through if getAsFileSystemHandle is missing', () => {
      mockGetDroppedFilePath.mockReturnValue('/path/file.md');
      const props = makeProps({ isDesktop: false, isChrome: true, openDroppedFolder: vi.fn() });
      const file = new File([''], 'file.md', { type: '' });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [file], items: [{}] });
      act(() => { window.dispatchEvent(event); });
      expect(props.openDroppedPath).toHaveBeenCalledWith('/path/file.md');
    });

    it('chrome path: falls through if getAsFileSystemHandle throws', async () => {
      mockGetDroppedFilePath.mockReturnValue('/path/file.md');
      const getAsFileSystemHandle = vi.fn().mockRejectedValue(new Error('fail'));
      const item = { getAsFileSystemHandle };
      const openDroppedFolder = vi.fn();
      const props = makeProps({ isDesktop: false, isChrome: true, openDroppedFolder });
      const file = new File([''], 'file.md', { type: '' });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [file], items: [item] });
      act(() => { window.dispatchEvent(event); });
      await vi.waitFor(() => {
        expect(props.openDroppedPath).toHaveBeenCalledWith('/path/file.md');
      });
      consoleSpy.mockRestore();
    });

    it('web path: calls openDroppedFolder for directory handle', async () => {
      const handle = { kind: 'directory' };
      const getAsFileSystemHandle = vi.fn().mockResolvedValue(handle);
      const item = { getAsFileSystemHandle };
      const openDroppedFolder = vi.fn();
      const props = makeProps({ isDesktop: false, isChrome: false, isWebDemo: true, openDroppedFolder, openDroppedFileHandle: vi.fn() });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [], items: [item] });
      act(() => { window.dispatchEvent(event); });
      await vi.waitFor(() => {
        expect(openDroppedFolder).toHaveBeenCalledWith(handle);
        expect(props.openDroppedFileHandle).not.toHaveBeenCalled();
      });
    });

    it('web path: calls openDroppedFileHandle for file handle', async () => {
      const handle = { kind: 'file' };
      const getAsFileSystemHandle = vi.fn().mockResolvedValue(handle);
      const item = { getAsFileSystemHandle };
      const openDroppedFileHandle = vi.fn();
      const props = makeProps({ isDesktop: false, isChrome: false, isWebDemo: true, openDroppedFolder: vi.fn(), openDroppedFileHandle });
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      const { event } = createDragEvent('drop', { files: [], items: [item] });
      act(() => { window.dispatchEvent(event); });
      await vi.waitFor(() => {
        expect(openDroppedFileHandle).toHaveBeenCalledWith(handle);
        expect(props.openDroppedFolder).not.toHaveBeenCalled();
      });
    });
  });

  describe('dragend', () => {
    it('resets drag state', () => {
      const props = makeProps();
      const { result } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      expect(result.current.isDragging).toBe(true);
      act(() => { window.dispatchEvent(new Event('dragend')); });
      expect(result.current.isDragging).toBe(false);
    });

    it('removes is-dragging-files class', () => {
      const props = makeProps();
      renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      act(() => { window.dispatchEvent(new Event('dragend')); });
      expect(document.body.classList.contains('is-dragging-files')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes all listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const props = makeProps();
      const { unmount } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      unmount();
      const calls = removeSpy.mock.calls.map((c) => c[0]);
      expect(calls).toContain('dragenter');
      expect(calls).toContain('dragleave');
      expect(calls).toContain('dragover');
      expect(calls).toContain('drop');
      expect(calls).toContain('dragend');
      removeSpy.mockRestore();
    });

    it('resets drag state on unmount', () => {
      const props = makeProps();
      const { result, unmount } = renderHook((p) => useFileDropOpen(p!), { initialProps: props });
      act(() => { window.dispatchEvent(createDragEvent('dragenter').event); });
      expect(result.current.isDragging).toBe(true);
      unmount();
      expect(document.body.classList.contains('is-dragging-files')).toBe(false);
    });
  });
});
