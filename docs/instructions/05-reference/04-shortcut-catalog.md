---
timestamp: '2026-08-01T22:54:00+07:00'
name: Keyboard Shortcut Catalog
topic: Runtime-specific default shortcut catalog
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
- ui/src/components/Settings/settingsActions.ts
- ui/src/components/Topbar/Topbar.tsx
- ui/src/components/shared/ToolbarActionMenu.tsx
test_scope:
- tests/unit/ui/hooks/useKeyboard.test.ts
- tests/unit/ui/hooks/resolveKeyboardAction.test.ts
- tests/unit/ui/utils/shortcuts.test.ts
- tests/node/bookmark-shortcut-settings.test.mjs
- tests/node/settings-ux-followup-contract.test.mjs
runtime_scope:
- shared
keywords:
- keyboard
- shortcuts
---

# Keyboard Shortcut Catalog

| Action ID | Chromium/Web default | VS Code default | Desktop default |
|---|---|---|---|
| `searchCurrent` | Ctrl+K | Ctrl+K | Ctrl+F |
| `searchAllTabs` | Ctrl+Shift+K | Ctrl+Shift+K | Ctrl+Shift+F |
| `findCurrentFile` | K | K | F |
| `back` | Ctrl+ArrowLeft | Ctrl+ArrowLeft | Ctrl+ArrowLeft |
| `forward` | Ctrl+ArrowRight | Ctrl+ArrowRight | Ctrl+ArrowRight |
| `welcome` | Ctrl+H | Ctrl+H | Ctrl+H |
| `editCurrentDocument` | — | Ctrl+Alt+E | Ctrl+E |
| `settings` | Ctrl+I | Ctrl+I | Ctrl+, |
| `toggleTheme` | Ctrl+Shift+L | Ctrl+Shift+L | Ctrl+L |
| `refresh` | R | R | F5 |
| `collapseAll` | Ctrl+Shift+X | Ctrl+Shift+X | Ctrl+Shift+X |
| `expandAll` | Ctrl+Shift+E | Ctrl+Shift+E | Ctrl+Shift+E |
| `workspaceSelection` | Ctrl+Alt+W | Ctrl+Alt+W | Ctrl+N |
| `toggleSidebar` | Alt+A | Alt+A | Ctrl+B |
| `openBookmarks` | Alt+Shift+B | Alt+Shift+B | Ctrl+Shift+B |
| `toggleToc` | Alt+C | Alt+C | Ctrl+T |
| `sidebarCursorMode` | Alt+Z | Alt+Z | Alt+Z |
| `zoomIn` | — | — | Ctrl+= |
| `zoomOut` | — | — | Ctrl+- |
| `resetZoom` | — | — | Ctrl+Alt+Z |
| `locateFile` | Alt+Q | Alt+Q | Alt+Q |
| `toggleFocusMode` | Ctrl+Alt+F | Ctrl+Alt+F | Ctrl+Alt+F |
| `toggleHtmlPreview` | Ctrl+Alt+H | Ctrl+Alt+H | Ctrl+Alt+H |
| `toggleDesktopViewMode` | — | — | Ctrl+Alt+T |
| `openCurrentDocumentLocation` | — | — | Shift+Alt+R |
| `closeContentTab` | — | — | Ctrl+W |
| `closeAllContentTabs` | — | — | Ctrl+Shift+W |
| `closeContentTabsToRight` | — | — | Ctrl+Alt+W |
| `closeOtherContentTabs` | — | — | Ctrl+Alt+O |

## Fixed behavior

- **Edit current document** (`editCurrentDocument`) exists only where the host can open the current file in an editor: Desktop uses `Ctrl+E`, VS Code uses `Ctrl+Alt+E`, and Chromium/Web exposes no Edit action or binding.
- VS Code renders Edit as an icon-only toolbar action immediately before More actions; Desktop keeps Edit inside More actions.
- Desktop F11 toggles fullscreen and ignores repeat events.
- Desktop `Ctrl+Alt+Z` resets zoom to 100%. VS Code and Chromium/Web use native host zoom and expose no Markdown Explorer zoom/reset binding.
- Ctrl/Cmd is treated as the primary modifier for matching across platforms.
- `Ctrl+Space` is not an acceptable custom binding because it conflicts with IME input.
- Editable inputs/textareas/selects/contenteditable retain normal typing unless a specific guarded action applies.
- User bindings override defaults; `disabledKeybindings[actionId]` removes the action binding.
- `openBookmarks` selects the Bookmarks tab when enabled; otherwise it opens Settings focused on **Enable Bookmark feature**.
- **Media modal gate exception**: `toggleTheme` fires through the media modal's keyboard gate (the matcher is lifted above `isModalOpen` in `resolveKeyboardAction`) so users can flip light/dark while the image/SVG modal is open. All other global shortcuts remain muted inside the modal. The terms dialog still captures the same shortcut (the matcher sits below `isTermsOpen`).

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/contexts/appStateConstants.ts` | Active behavior or contract |
| Implementation | `ui/src/hooks/keyboardUtils.ts` | Active behavior or contract |
| Implementation | `ui/src/hooks/useKeyboard.ts` | Active behavior or contract |
| Implementation | `ui/src/utils/shortcuts.ts` | Active behavior or contract |
| Implementation | `ui/src/components/Settings/settingsActions.ts` | Host-scoped Edit shortcut registration |
| Implementation | `ui/src/components/Topbar/Topbar.tsx` | VS Code dedicated Edit toolbar action |
| Implementation | `ui/src/components/shared/ToolbarActionMenu.tsx` | Desktop More-actions Edit tooltip/shortcut |
| Verification | `tests/unit/ui/hooks/useKeyboard.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/hooks/resolveKeyboardAction.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/utils/shortcuts.test.ts` | Automated expectation |
| Verification | `tests/node/bookmark-shortcut-settings.test.mjs` | Bookmark defaults, routing, setting focus, and reset warning style |
| Verification | `tests/node/settings-ux-followup-contract.test.mjs` | Runtime-specific Edit defaults, routing, toolbar placement, docs |

---

[← Settings Catalog](03-settings-catalog.md) · [Documentation index](../README.md) · [Theme Catalog →](05-theme-catalog.md)
