---
timestamp: '2026-08-01T22:54:00+07:00'
name: Keyboard Shortcut Catalog
topic: Shared and Electron desktop default shortcut catalog
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/14-keyboard-accessibility-responsive.md
related_docs:
- 03-settings-catalog.md
source_scope:
- ui/src/contexts/appStateConstants.ts
- ui/src/hooks/keyboardUtils.ts
- ui/src/hooks/useKeyboard.ts
- ui/src/utils/shortcuts.ts
test_scope:
- tests/unit/ui/hooks/useKeyboard.test.ts
- tests/unit/ui/hooks/resolveKeyboardAction.test.ts
- tests/unit/ui/utils/shortcuts.test.ts
- tests/node/bookmark-shortcut-settings.test.mjs
runtime_scope:
- shared
keywords:
- keyboard
- shortcuts
---

# Keyboard Shortcut Catalog

| Action ID | Shared default | Electron desktop default |
|---|---|---|
| `searchCurrent` | Ctrl+K | Ctrl+F |
| `searchAllTabs` | Ctrl+Shift+K | Ctrl+Shift+F |
| `findCurrentFile` | K | F |
| `back` | Ctrl+ArrowLeft | Same |
| `forward` | Ctrl+ArrowRight | Same |
| `welcome` | Ctrl+H | Same |
| `settings` | Ctrl+I | Ctrl+, |
| `toggleTheme` | Ctrl+Shift+L | Ctrl+L |
| `refresh` | R | F5 |
| `collapseAll` | Ctrl+Shift+X | Same |
| `expandAll` | Ctrl+Shift+E | Same |
| `workspaceSelection` | Ctrl+Alt+W | Ctrl+N |
| `toggleSidebar` | Alt+A | Ctrl+B |
| `openBookmarks` | Alt+Shift+B | Ctrl+Shift+B |
| `toggleToc` | Alt+C | Ctrl+T |
| `sidebarCursorMode` | Alt+Z | Same |
| `zoomIn` | Ctrl+= | Same |
| `zoomOut` | Ctrl+- | Same |
| `locateFile` | Alt+Q | Same |
| `toggleFocusMode` | Ctrl+Alt+F | Same |
| `toggleHtmlPreview` | Ctrl+Alt+H | Same |
| `toggleDesktopViewMode` | — | Ctrl+Alt+T |
| `openCurrentDocumentLocation` | — | Shift+Alt+R |
| `closeContentTab` | — | Ctrl+W |
| `closeAllContentTabs` | — | Ctrl+Shift+W |
| `closeContentTabsToRight` | — | Ctrl+Alt+W |
| `closeOtherContentTabs` | — | Ctrl+Alt+O |

## Fixed behavior

- Desktop F11 toggles fullscreen and ignores repeat events.
- Desktop Ctrl/Cmd+0 resets zoom.
- Ctrl/Cmd is treated as the primary modifier for matching across platforms.
- `Ctrl+Space` is not an acceptable custom binding because it conflicts with IME input.
- Editable inputs/textareas/selects/contenteditable retain normal typing unless a specific guarded action applies.
- User bindings override defaults; `disabledKeybindings[actionId]` removes the action binding.
- `openBookmarks` selects the Bookmarks tab when enabled; otherwise it opens Settings focused on **Enable Bookmark feature**.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/contexts/appStateConstants.ts` | Active behavior or contract |
| Implementation | `ui/src/hooks/keyboardUtils.ts` | Active behavior or contract |
| Implementation | `ui/src/hooks/useKeyboard.ts` | Active behavior or contract |
| Implementation | `ui/src/utils/shortcuts.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/hooks/useKeyboard.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/hooks/resolveKeyboardAction.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/utils/shortcuts.test.ts` | Automated expectation |
| Verification | `tests/node/bookmark-shortcut-settings.test.mjs` | Bookmark defaults, routing, setting focus, and reset warning style |

---

[← Settings Catalog](03-settings-catalog.md) · [Documentation index](../README.md) · [Theme Catalog →](05-theme-catalog.md)
