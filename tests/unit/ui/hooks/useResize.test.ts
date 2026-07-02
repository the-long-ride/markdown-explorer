import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResize } from '../../../../ui/src/hooks/useResize';

function createElement(id: string, width = 250): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  Object.defineProperty(el, 'offsetWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(el, 'hasPointerCapture', { value: vi.fn().mockReturnValue(true), writable: true, configurable: true });
  Object.defineProperty(el, 'setPointerCapture', { value: vi.fn(), writable: true, configurable: true });
  Object.defineProperty(el, 'releasePointerCapture', { value: vi.fn(), writable: true, configurable: true });
  document.body.appendChild(el);
  return el;
}

function removeElement(id: string) {
  document.getElementById(id)?.remove();
}

function dispatchPointer(target: EventTarget, type: string, opts: Partial<PointerEventInit> = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    button: 0,
    clientX: 0,
    ...opts,
  });
  target.dispatchEvent(event);
}

describe('useResize', () => {
  let handleEl: HTMLElement;
  let targetEl: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--sidebar-width');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('is-resizing');

    handleEl = createElement('handle');
    targetEl = createElement('target');
  });

  afterEach(() => {
    removeElement('handle');
    removeElement('target');
    document.body.classList.remove('is-resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.documentElement.style.removeProperty('--sidebar-width');
  });

  it('binds pointer listeners on mount when elements exist', () => {
    const addSpy = vi.spyOn(handleEl, 'addEventListener');
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    addSpy.mockRestore();
  });

  it('sets up MutationObserver when handle not found', () => {
    removeElement('handle');
    vi.useFakeTimers();
    const ObserverMock = vi.fn();
    ObserverMock.prototype.observe = vi.fn();
    ObserverMock.prototype.disconnect = vi.fn();
    const orig = (window as any).MutationObserver;
    (window as any).MutationObserver = ObserverMock;
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle-missing', targetId: 'target' },
    });
    expect(ObserverMock).toHaveBeenCalled();
    (window as any).MutationObserver = orig;
    vi.useRealTimers();
  });

  it('binds via rAF when elements appear after mount', () => {
    vi.useFakeTimers();
    removeElement('handle');
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle-late', targetId: 'target' },
    });
    const lateEl = createElement('handle-late');
    act(() => { vi.advanceTimersByTime(32); });
    dispatchPointer(lateEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    expect(document.body.classList.contains('is-resizing')).toBe(true);
    dispatchPointer(document, 'pointermove', { clientX: 300, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('350px');
    dispatchPointer(document, 'pointerup', { pointerId: 1 });
    removeElement('handle-late');
    vi.useRealTimers();
  });

  it('starts drag on pointer down with button 0', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 100, pointerId: 1 });
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.classList.contains('is-resizing')).toBe(true);
  });

  it('ignores pointer down with non-zero button', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 2, clientX: 100, pointerId: 1 });
    expect(document.body.style.cursor).not.toBe('col-resize');
  });

  it('calculates and clamps width on pointer move (ltr)', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { min: 100, max: 400 }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 280, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('330px');
  });

  it('clamps width to min', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { min: 200, max: 400 }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 100, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('200px');
  });

  it('clamps width to max', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { min: 100, max: 300 }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 400, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('300px');
  });

  it('inverts delta for rtl direction', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { min: 100, max: 400, direction: 'rtl' }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 280, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('170px');
  });

  it('sets custom css variable', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { cssVar: '--my-width', min: 100, max: 400 }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 250, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--my-width');
    expect(val).toBe('300px');
  });

  it('persists width to localStorage with custom storageKey', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { storageKey: 'custom-key', min: 100, max: 400 }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 250, pointerId: 1 });
    expect(localStorage.getItem('custom-key')).toBe('300');
  });

  it('stops drag on pointerup', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    expect(document.body.classList.contains('is-resizing')).toBe(true);
    dispatchPointer(document, 'pointerup', { pointerId: 1 });
    expect(document.body.classList.contains('is-resizing')).toBe(false);
    expect(document.body.style.cursor).toBe('');
  });

  it('stops drag on pointercancel', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointercancel', { pointerId: 1 });
    expect(document.body.classList.contains('is-resizing')).toBe(false);
  });

  it('releases pointer capture on stop', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointerup', { pointerId: 1 });
    expect(handleEl.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('does not move when not dragging', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId, undefined, { min: 100, max: 400 }), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(document, 'pointermove', { clientX: 500, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('');
  });

  it('cancels rAF and disconnects observer on unmount', () => {
    removeElement('handle');
    vi.useFakeTimers();
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle-gone', targetId: 'target' },
    });
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
    vi.useRealTimers();
  });

  it('removes listeners on unmount', () => {
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');
    const removeHandleSpy = vi.spyOn(handleEl, 'removeEventListener');
    const { unmount } = renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    unmount();
    expect(removeHandleSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith('pointercancel', expect.any(Function));
    removeDocSpy.mockRestore();
    removeHandleSpy.mockRestore();
  });

  it('restores body state on unmount during drag', () => {
    const { unmount } = renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    expect(document.body.classList.contains('is-resizing')).toBe(true);
    unmount();
    expect(document.body.classList.contains('is-resizing')).toBe(false);
    expect(document.body.style.cursor).toBe('');
  });

  it('uses default min 180 and max 480 when not specified', () => {
    renderHook(({ handleId, targetId }) => useResize(handleId, targetId), {
      initialProps: { handleId: 'handle', targetId: 'target' },
    });
    dispatchPointer(handleEl, 'pointerdown', { button: 0, clientX: 200, pointerId: 1 });
    dispatchPointer(document, 'pointermove', { clientX: 500, pointerId: 1 });
    const val = document.documentElement.style.getPropertyValue('--sidebar-width');
    expect(val).toBe('480px');
  });
});
