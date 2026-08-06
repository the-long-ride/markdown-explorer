// =============================================================================
// components/shared/parseShortcutText.tsx
// Helper to parse text containing (Shortcut), [Shortcut], or bare Ctrl+Alt+Key into 3D keycaps
// =============================================================================

import { ShortcutKeycaps } from './ShortcutKeycaps';

export function parseShortcutText(text?: string) {
  if (!text) return null;

  const regex = /(\[[^\]]+\]|\((?:Ctrl|Cmd|Alt|Shift|Meta|F\d+|[A-Za-z0-9,/\\;:'`\[\]=-]+\+?)[^)]*\)|(?:Ctrl|Cmd|Alt|Shift|Meta)\+(?:[A-Za-z0-9,/\\;:'`\[\]=-]+\+?)*[A-Za-z0-9,/\\;:'`\[\]=-]+)/gi;

  if (!regex.test(text)) {
    return text;
  }

  const parts = text.split(regex);

  return (
    <>
      <span className="sr-only">
        {text}
      </span>
      <span aria-hidden="true" className="tooltip-content-wrap">
        {parts.map((part, idx) => {
          let key = '';
          if (part.startsWith('[') && part.endsWith(']')) {
            key = part.slice(1, -1);
          } else if (part.startsWith('(') && part.endsWith(')')) {
            const inner = part.slice(1, -1);
            if (
              /^(?:Ctrl|Cmd|Alt|Shift|Meta|F\d+|[A-Z0-9,/\\;:'`\[\]=-])(?:\+[A-Za-z0-9,/\\;:'`\[\]=-]+)*$/i.test(inner) ||
              inner.includes('+')
            ) {
              key = inner;
            }
          } else if (/^(?:Ctrl|Cmd|Alt|Shift|Meta)\+(?:[A-Za-z0-9,/\\;:'`\[\]=-]+\+?)*[A-Za-z0-9,/\\;:'`\[\]=-]+$/i.test(part)) {
            key = part;
          }

          if (key) {
            return <ShortcutKeycaps key={idx} shortcut={key} size="sm" />;
          }

          return part;
        })}
      </span>
    </>
  );
}
