// =============================================================================
// components/Content/renderWelcomeDescription.tsx
// Renders description text with 3D keycaps for shortcut tokens
// =============================================================================

import { ShortcutKeycaps } from '../shared/ShortcutKeycaps';

export function renderWelcomeDescription(text: string) {
  if (!text) return null;

  // Tokenize text for shortcuts in [brackets] or (parentheses)
  const parts = text.split(/(\[[^\]]+\]|\((?:Ctrl\+|Cmd\+|Alt\+|Shift\+|Meta\+|F\d+|[A-Za-z0-9,/\\;:'`\[\]=-]+\+?)[^)]*\))/gi);

  return parts.map((part, idx) => {
    let key = '';
    if (part.startsWith('[') && part.endsWith(']')) {
      key = part.slice(1, -1);
    } else if (part.startsWith('(') && part.endsWith(')')) {
      const inner = part.slice(1, -1);
      // Verify if inner content is a shortcut key sequence or key name
      if (
        /^(?:Ctrl|Cmd|Alt|Shift|Meta|F\d+|[A-Z0-9,/\\;:'`\[\]=-])(?:\+[A-Za-z0-9,/\\;:'`\[\]=-]+)*$/i.test(inner) ||
        inner === 'Mouse Wheel' ||
        inner === 'Left/Right' ||
        inner.includes('+')
      ) {
        key = inner;
      }
    }

    if (key) {
      if (key === 'Mouse Wheel' || key === 'Left/Right') {
        return <kbd key={idx} className="keycap-3d">{key}</kbd>;
      }
      return <ShortcutKeycaps key={idx} shortcut={key} size="sm" />;
    }

    return part;
  });
}
