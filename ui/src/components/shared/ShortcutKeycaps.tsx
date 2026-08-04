// =============================================================================
// components/shared/ShortcutKeycaps.tsx — 3D Keycap keyboard shortcut renderer
// =============================================================================

import { formatShortcutLabel } from '../../utils/shortcuts';

interface ShortcutKeycapsProps {
  shortcut?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ShortcutKeycaps({ shortcut, className = '', size = 'md' }: ShortcutKeycapsProps) {
  if (!shortcut) return null;
  const formatted = formatShortcutLabel(shortcut);
  if (!formatted) return null;
  const parts = formatted.split('+');

  return (
    <span className={`shortcut-keycaps-container shortcut-keycaps-container--${size}${className ? ` ${className}` : ''}`.trim()}>
      {parts.map((part, idx) => (
        <span key={idx} className="shortcut-keycap-item">
          {idx > 0 && <span className="keycap-plus" aria-hidden="true">+</span>}
          <kbd className="keycap-3d">{part}</kbd>
        </span>
      ))}
    </span>
  );
}
