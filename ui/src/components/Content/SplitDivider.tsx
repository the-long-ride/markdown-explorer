import { flushDeferredHtmlPreviewHeights } from '../../dom/globalHandlers';

interface SplitDividerProps {
  ratio: number;
  onRatioChange: (ratio: number) => void;
  label?: string;
}

const MIN_RATIO = 0.25;
const MAX_RATIO = 0.75;
const STEP = 0.02;

function clampRatio(value: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, Math.round(value * 100) / 100));
}

export function SplitDivider({ ratio, onRatioChange, label = 'Resize document panes' }: SplitDividerProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = ratio - STEP;
    if (event.key === 'ArrowRight') next = ratio + STEP;
    if (event.key === 'Home') next = MIN_RATIO;
    if (event.key === 'End') next = MAX_RATIO;
    if (next === null) return;
    event.preventDefault();
    onRatioChange(clampRatio(next));
  };

  // Dragging only rewrites the grid CSS variables, once per animation frame;
  // the ratio reaches app state once on release. Dispatching per pointermove
  // re-rendered the app and re-laid out both documents on every step.
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const divider = event.currentTarget;
    const root = divider.parentElement;
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    if (bounds.width <= 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const startRatio = ratio;
    let liveRatio = ratio;
    let latestX: number | null = null;
    let frame: number | null = null;

    const apply = (value: number) => {
      root.style.setProperty('--split-primary-size', `${value}fr`);
      root.style.setProperty('--split-secondary-size', `${Math.round((1 - value) * 100) / 100}fr`);
      divider.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    };
    const runFrame = () => {
      frame = null;
      if (latestX === null) return;
      liveRatio = clampRatio((latestX - bounds.left) / bounds.width);
      apply(liveRatio);
    };
    const isOtherPointer = (pointerEvent: PointerEvent) => pointerEvent.pointerId !== undefined && pointerEvent.pointerId !== pointerId;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (isOtherPointer(moveEvent)) return;
      latestX = moveEvent.clientX;
      if (frame === null) frame = window.requestAnimationFrame(runFrame);
    };
    const cleanup = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      root.classList.remove('is-split-resizing');
      document.body.classList.remove('is-split-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', handleKey, true);
      flushDeferredHtmlPreviewHeights(root);
    };
    function finish(endEvent: PointerEvent) {
      if (isOtherPointer(endEvent)) return;
      latestX = endEvent.clientX;
      runFrame();
      cleanup();
      if (liveRatio !== startRatio) onRatioChange(liveRatio);
    }
    function cancel() {
      apply(startRatio);
      cleanup();
    }
    function handleKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key !== 'Escape') return;
      keyEvent.preventDefault();
      cancel();
    }

    root.classList.add('is-split-resizing');
    document.body.classList.add('is-split-resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', handleKey, true);
  };

  return (
    <div
      className="split-document-divider"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={25}
      aria-valuemax={75}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    />
  );
}
