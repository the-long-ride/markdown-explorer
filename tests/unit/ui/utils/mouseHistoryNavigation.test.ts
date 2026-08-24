import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachMouseHistoryNavigation,
  getMouseHistoryDirection,
} from '../../../../ui/src/utils/mouseHistoryNavigation';

function fire(type: string, button: number, timeStamp?: number): MouseEvent {
  const event = new MouseEvent(type, { button, bubbles: true, cancelable: true });
  if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  window.dispatchEvent(event);
  return event;
}

describe('getMouseHistoryDirection', () => {
  it('maps XButton1/XButton2 onto back/forward', () => {
    expect(getMouseHistoryDirection(3)).toBe('back');
    expect(getMouseHistoryDirection(4)).toBe('forward');
  });

  it('ignores primary/middle/secondary buttons', () => {
    expect(getMouseHistoryDirection(0)).toBeNull();
    expect(getMouseHistoryDirection(1)).toBeNull();
    expect(getMouseHistoryDirection(2)).toBeNull();
    expect(getMouseHistoryDirection(-1)).toBeNull();
  });
});

describe('attachMouseHistoryNavigation', () => {
  let onNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onNavigate = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('collapses one press delivered through every event family into a single navigation', () => {
    const detach = attachMouseHistoryNavigation(onNavigate);
    const press = fire('pointerup', 3, 100);
    fire('mouseup', 3, 105);
    fire('auxclick', 3, 110);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('back');
    expect(press.defaultPrevented).toBe(true);
    detach();
  });

  it('keeps reacting to the opposite direction inside the same burst', () => {
    const detach = attachMouseHistoryNavigation(onNavigate);
    fire('mouseup', 4, 0);
    fire('mouseup', 4, 10);
    fire('mouseup', 3, 20);

    expect(onNavigate.mock.calls).toEqual([['forward'], ['back']]);
    detach();
  });

  it('navigates again once the burst window has passed', () => {
    const detach = attachMouseHistoryNavigation(onNavigate);
    fire('mouseup', 3, 0);
    fire('mouseup', 3, 41);

    expect(onNavigate).toHaveBeenCalledTimes(2);
    detach();
  });

  it('capture-phase instance outruns an earlier bubble-phase history handler', () => {
    // Mirrors production topology: the modal's capture listener must silence
    // the global bubble-phase handler registered long before it.
    const globalListener = vi.fn();
    const detachGlobal = attachMouseHistoryNavigation(globalListener);
    const detachScoped = attachMouseHistoryNavigation(onNavigate, { capture: true });
    const event = new MouseEvent('mouseup', { button: 4, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'timeStamp', { value: 0 });
    document.body.dispatchEvent(event);

    expect(onNavigate).toHaveBeenCalledWith('forward');
    expect(event.defaultPrevented).toBe(true);
    expect(globalListener).not.toHaveBeenCalled();

    detachScoped();
    detachGlobal();
  });

  it('supports capture-phase registration for modal-scoped handlers', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const detach = attachMouseHistoryNavigation(onNavigate, { capture: true });
    fire('auxclick', 3, 0);

    expect(onNavigate).toHaveBeenCalledWith('back');

    detach();
    for (const name of ['pointerup', 'mouseup', 'auxclick']) {
      expect(removeSpy).toHaveBeenCalledWith(name, expect.any(Function), true);
    }
    removeSpy.mockRestore();
  });

  it('removes pointerup/mouseup/auxclick listeners on cleanup', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const detach = attachMouseHistoryNavigation(onNavigate);
    detach();

    for (const name of ['pointerup', 'mouseup', 'auxclick']) {
      expect(removeSpy).toHaveBeenCalledWith(name, expect.any(Function));
    }
    removeSpy.mockRestore();
  });

  it('prevents native navigation on mousedown/pointerdown without navigating', () => {
    const detach = attachMouseHistoryNavigation(onNavigate);
    const down = fire('mousedown', 3, 0);
    const pointerDown = fire('pointerdown', 4, 10);
    expect(down.defaultPrevented).toBe(true);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
    detach();
  });

  it('navigates once when mousedown is followed by mouseup (Logitech press)', () => {
    const detach = attachMouseHistoryNavigation(onNavigate);
    const down = fire('mousedown', 3, 0);
    fire('mouseup', 3, 10);
    expect(down.defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('back');
    detach();
  });

  it('handles pointerdown then pointerup as single navigation', () => {
    const detach = attachMouseHistoryNavigation(onNavigate);
    fire('pointerdown', 4, 0);
    fire('pointerup', 4, 15);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('forward');
    detach();
  });
});
