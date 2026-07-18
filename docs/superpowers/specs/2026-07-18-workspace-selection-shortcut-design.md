# Workspace Selection Shortcut Design

## Goal

Add a direct keyboard shortcut for returning to workspace selection without changing existing user-customized keybindings.

## Behavior

- Desktop default: `Ctrl+N`.
- Other platforms, including the VS Code extension: `Ctrl+Alt+W`.
- Tab view: invoke workspace selection immediately.
- Focus view: show the existing custom confirmation dialog. Cancel/No closes only the dialog. Confirm/Yes closes the current workspace and returns to workspace selection.
- Existing saved `workspaceSelection` keybinding values remain authoritative; only default values change.
- Confirmation buttons follow the existing convention: Cancel on the left, Confirm on the right; Escape cancels and Enter confirms where supported.

## Design

Keep the existing `workspaceSelection` keyboard action and keybinding setting. Update platform defaults in `appStateConstants.ts`. Pass an App-owned workspace-selection callback into `useKeyboard`, because App owns `desktopViewMode`, workspace state reset, and the custom dialog state. The callback closes immediately in tabs mode; in focus mode it opens the existing custom confirmation dialog and performs the existing workspace reset/bridge message only after confirmation.

Avoid adding a second action or hard-coded shortcut so settings UI, localization, and existing custom keybindings remain compatible.

## Testing

Add unit coverage for platform default keybindings and keyboard action resolution for both new shortcuts. Add behavior coverage for the App callback or extracted workspace-selection decision helper: tabs proceeds immediately, focus requires confirmation, cancel does not close the workspace, and confirm does.

## Documentation

Update the user-facing shortcut documentation/README entry if the existing documentation lists workspace-selection shortcuts.
