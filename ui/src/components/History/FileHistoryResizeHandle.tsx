import type { KeyboardEvent, PointerEvent } from 'react';

interface FileHistoryResizeHandleProps {
  readonly className: string;
  readonly label: string;
  readonly valueNow: number;
  readonly valueMin: number;
  readonly valueMax: number;
  onResize(clientX: number): void;
  onStep(steps: number): void;
  onReset(): void;
}

const KEY_DIRECTION: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };
const LARGE_STEP = 4;

/** Vertical splitter: drag with the pointer, nudge with arrow keys (Shift = larger), double-click to reset. */
export function FileHistoryResizeHandle({ className, label, valueNow, valueMin, valueMax, onResize, onStep, onReset }: FileHistoryResizeHandleProps) {
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const { pointerId } = event;
    handle.setPointerCapture?.(pointerId);
    handle.classList.add('is-dragging');
    document.body.classList.add('is-file-history-resizing');
    const move = (next: globalThis.PointerEvent) => onResize(next.clientX);
    const end = () => {
      handle.classList.remove('is-dragging');
      document.body.classList.remove('is-file-history-resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = KEY_DIRECTION[event.key];
    if (!direction) return;
    event.preventDefault();
    onStep(direction * (event.shiftKey ? LARGE_STEP : 1));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(valueNow)}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      tabIndex={0}
      title={label}
      className={`file-history__resizer ${className}`}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
    />
  );
}
