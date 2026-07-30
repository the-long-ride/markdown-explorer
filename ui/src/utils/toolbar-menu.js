export function formatToolbarShortcutLabel(shortcut) {
  return String(shortcut || "")
    .split("+")
    .map((part) => {
      const trimmed = part.trim();
      return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed;
    })
    .filter(Boolean)
    .join("+");
}

export function buildShortcutTooltip(tooltip, shortcut) {
  const baseLabel = String(tooltip || "");
  const shortcutLabel = formatToolbarShortcutLabel(shortcut);
  if (!baseLabel || !shortcutLabel) return baseLabel;
  return `${baseLabel} - (${shortcutLabel})`;
}
