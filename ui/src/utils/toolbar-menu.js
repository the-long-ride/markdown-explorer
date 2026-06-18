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

export function createToolbarMenuItems({
  labels,
  tooltips,
  shortcuts = {},
  canEdit = true,
}) {
  return [
    {
      id: "home",
      label: labels.home,
      tooltip: buildShortcutTooltip(tooltips.home, shortcuts.home),
      disabled: false,
    },
    {
      id: "theme",
      label: labels.theme,
      tooltip: buildShortcutTooltip(tooltips.theme, shortcuts.theme),
      disabled: false,
    },
    {
      id: "edit",
      label: labels.edit,
      tooltip: buildShortcutTooltip(tooltips.edit, shortcuts.edit),
      disabled: !canEdit,
    },
    {
      id: "settings",
      label: labels.settings,
      tooltip: buildShortcutTooltip(tooltips.settings, shortcuts.settings),
      disabled: false,
    },
  ];
}
