// =============================================================================
// utils/mouseHistoryNavigation.ts — Mouse Back/Forward button detection
// =============================================================================

export type MouseHistoryDirection = 'back' | 'forward';

/** XButton1 (Back) and XButton2 (Forward) as reported by `MouseEvent.button`. */
const HISTORY_MOUSE_BUTTONS: Record<number, MouseHistoryDirection> = {
  3: 'back',
  4: 'forward',
};

/**
 * Burst window (ms) that absorbs the duplicate events a single physical press
 * emits across the pointer/mouse/auxclick event families.
 */
const DUPLICATE_BURST_MS = 40;

export function getMouseHistoryDirection(button: number): MouseHistoryDirection | null {
  return HISTORY_MOUSE_BUTTONS[button] ?? null;
}

interface AttachMouseHistoryNavigationOptions {
  /**
   * Register in the capture phase so these handlers run before any
   * bubble-phase history handler (e.g. the global one in `useKeyboard`).
   */
  capture?: boolean;
}

/**
 * Listen for mouse Back/Forward across every delivery variant (`pointerup`,
 * `mouseup`, `auxclick`) — devices, drivers and embedded webviews differ in
 * which family they emit for XButton1/XButton2. One physical press can emit
 * several of these events; repeats of the same direction inside the burst
 * window are collapsed into a single navigation.
 *
 * Each matched event has its default action prevented (stops native history
 * navigation) and propagation stopped immediately (other history handlers
 * must not react a second time).
 */
export function attachMouseHistoryNavigation(
  onNavigate: (direction: MouseHistoryDirection) => void,
  options: AttachMouseHistoryNavigationOptions = {},
): () => void {
  const capture = options.capture === true;
  let lastDirection: MouseHistoryDirection | null = null;
  let lastTimestamp = -Infinity;

  const handleNavigate = (event: Event): void => {
    const direction = getMouseHistoryDirection((event as MouseEvent).button);
    if (!direction) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const timestamp = typeof event.timeStamp === 'number' ? event.timeStamp : performance.now();
    if (direction === lastDirection && timestamp - lastTimestamp < DUPLICATE_BURST_MS) return;
    lastDirection = direction;
    lastTimestamp = timestamp;
    onNavigate(direction);
  };

  const handlePrevent = (event: Event): void => {
    const direction = getMouseHistoryDirection((event as MouseEvent).button);
    if (!direction) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const navigateEvents = ['pointerup', 'mouseup', 'auxclick'] as const;
  const preventEvents = ['pointerdown', 'mousedown'] as const;
  type NavigateEventName = (typeof navigateEvents)[number];
  type PreventEventName = (typeof preventEvents)[number];

  const addNavigate = (name: NavigateEventName) => (
    capture ? window.addEventListener(name, handleNavigate, true) : window.addEventListener(name, handleNavigate)
  );
  const removeNavigate = (name: NavigateEventName) => (
    capture ? window.removeEventListener(name, handleNavigate, true) : window.removeEventListener(name, handleNavigate)
  );
  const addPrevent = (name: PreventEventName) => (
    capture ? window.addEventListener(name, handlePrevent, true) : window.addEventListener(name, handlePrevent)
  );
  const removePrevent = (name: PreventEventName) => (
    capture ? window.removeEventListener(name, handlePrevent, true) : window.removeEventListener(name, handlePrevent)
  );

  navigateEvents.forEach(addNavigate);
  preventEvents.forEach(addPrevent);
  return () => {
    navigateEvents.forEach(removeNavigate);
    preventEvents.forEach(removePrevent);
  };
}
