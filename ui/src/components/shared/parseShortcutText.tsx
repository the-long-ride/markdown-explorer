// =============================================================================
// components/shared/parseShortcutText.tsx
// Helper to parse text containing (Shortcut), [Shortcut], or bare Ctrl+Alt+Key into 3D keycaps
// =============================================================================

import { ShortcutKeycaps } from './ShortcutKeycaps';

const BARE_SHORTCUT_RE = /^(?:Ctrl|Cmd|Alt|Shift|Meta|Maj|Mayús)(?:\+(?:←\/→|←|→|[A-Za-z0-9\u00C0-\u017F,/\\;'`\[\]=-]+))+$/i;
const BARE_SHORTCUT_SOURCE = BARE_SHORTCUT_RE.source.slice(1, -1);

export function parseShortcutText(text?: string) {
  if (!text) return null;

  const regex = new RegExp(
    `(\\[[^\\]]+\\]|\\((?:Ctrl|Cmd|Alt|Shift|Meta|Maj|Mayús|F\\d+|[A-Za-z0-9,/\\\\;:'\`\\[\\]=-]+\\+?)[^)]*\\)|${BARE_SHORTCUT_SOURCE})`,
    'gi',
  );

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
            const isNamedKey = /^(?:Esc(?:ape)?|Enter|Tab|Space|Backspace|Delete|Home|End|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(inner);
            if (
              isNamedKey ||
              /^(?:Ctrl|Cmd|Alt|Shift|Meta|F\d+|[A-Z0-9,/\\;:'`\[\]=-])(?:\+[A-Za-z0-9,/\\;:'`\[\]=-]+)*$/i.test(inner) ||
              inner.includes('+')
            ) {
              key = inner;
            }
          } else if (BARE_SHORTCUT_RE.test(part)) {
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
