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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const root = event.currentTarget.parentElement;
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    if (bounds.width <= 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const next = (moveEvent.clientX - bounds.left) / bounds.width;
      onRatioChange(clampRatio(next));
    };
    const finish = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
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
