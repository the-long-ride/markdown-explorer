const SHORTCUT_KEY_LABELS: Record<string, string> = {
  arrowleft: '←',
  arrowright: '→',
  esc: 'Esc',
  enter: 'Enter',
  'entrée': 'Entrée',
  entree: 'Entrée',
  intro: 'Intro',
  '←': '←',
  '→': '→',
  '←/→': '←/→',
};

const MODIFIER_LABELS: Record<string, string> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmd: 'Meta',
  command: 'Meta',
  meta: 'Meta',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  maj: 'Maj',
  'mayús': 'Mayús',
  mayus: 'Mayús',
};

function normalizeShortcutPart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return '';
  if (trimmed === '←/→' || trimmed === '←' || trimmed === '→') return trimmed;
  const normalized = trimmed.toLowerCase();
  const modifier = MODIFIER_LABELS[normalized];
  if (modifier) return modifier;
  const keyLabel = SHORTCUT_KEY_LABELS[normalized];
  if (keyLabel) return keyLabel;
  if (/^[,./;:'`\[\]\\=-]$/.test(trimmed)) return trimmed;
  return trimmed.toUpperCase();
}

export function formatShortcutLabel(shortcut: string, joiner = '+'): string {
  return shortcut
    .split('+')
    .map((part) => normalizeShortcutPart(part))
    .filter(Boolean)
    .join(joiner);
}

export function getEnabledShortcut(
  settings: { keybindings?: Record<string, string>; disabledKeybindings?: Record<string, boolean> },
  actionId: string,
): string | undefined {
  return settings.disabledKeybindings?.[actionId] ? undefined : settings.keybindings?.[actionId];
}
