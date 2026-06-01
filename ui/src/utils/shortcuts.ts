export function formatShortcutLabel(shortcut: string): string {
  return shortcut.split('+').map((part) => part.trim()).filter(Boolean).join('+');
}
