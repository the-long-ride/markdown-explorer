function normalizeShortcutPart(part: string): string {
  const trimmed = part.trim();
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed;
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
