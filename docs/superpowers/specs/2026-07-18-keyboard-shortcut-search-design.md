# Keyboard Shortcut Search Design

## Goal

Add a desktop-only search field to the Settings modal’s Keyboard Shortcuts section. Results update synchronously while typing, and users can search in English even when the app UI uses another language such as Norsk.

## Behavior

- Render the search field directly below the Keyboard Shortcuts header only in the Electron desktop app.
- Use the layout `[Search keyboard shortcuts...][×]`.
- Keep the query in local `SettingsModal` state; do not persist it in user settings.
- Clear the query when the clear button is activated.
- Empty query displays all currently visible actions.
- Non-empty query filters actions with case-insensitive substring matching.
- Search haystack includes each action’s translated label, canonical English label, and action ID.
- Search is synchronous so rows update on every input event.
- Existing desktop/non-desktop action visibility, shortcut recording, reset, and localization behavior remain unchanged.

## Implementation

Use the existing `visibleActions` list as the source of truth. Add a canonical English label map alongside the action definitions or in the Settings modal, then derive `filteredActions` from the query and render that list. Reuse the current desktop detection (`isDesktop`) so browser and extension surfaces do not receive the control.

Use accessible semantics: a labeled text input, a clear button with an accessible label, and a stable placeholder translated to English as requested. The clear control should be disabled or hidden when the query is empty, consistent with existing Settings styling.

## Testing

Add focused tests covering:

1. Desktop renders the search input below the shortcuts header.
2. Non-desktop does not render the search input.
3. English canonical label finds the matching action while current language is Norsk.
4. Translated label and action ID searches work case-insensitively.
5. Results update while typing and clearing restores all actions.

Tests should exercise the filtering behavior through the rendered Settings modal where practical, with a small pure helper only if needed to keep the assertions focused.

## Scope

No persisted settings schema changes, no translation migration, no changes to keyboard handling, and no changes to shortcut definitions beyond adding search metadata.
