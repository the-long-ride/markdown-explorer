# Fullscreen Mode Design

## Goal

Add transient native fullscreen support to Electron and Tauri. F11 is a fixed application shortcut, independent of `SettingModel` keyboard bindings. Users can also toggle fullscreen from the Settings button dropdown and see the live native window state.

## User experience

- Pressing F11 toggles native fullscreen in Electron and Tauri.
- Settings dropdown contains `Show full screen` immediately below `Toggle Focus mode`.
- Row includes a tooltip explaining fullscreen and `[F11]`.
- Right-side switch/icon reflects the current native fullscreen state.
- Homepage > Tab shortcuts lists F11 as a fixed shortcut.
- Fullscreen state is transient and is not included in settings import/export or persisted storage.

## Architecture

The shared UI owns the fixed shortcut and dropdown action. It sends a `toggle-fullscreen` platform command through the existing bridge. The native host owns fullscreen state:

- Electron calls `BrowserWindow.setFullScreen(!isFullScreen())` and reports enter/leave events to the renderer.
- Tauri calls the main `WebviewWindow` fullscreen API and reports the resulting state through its existing host-message bridge.
- The renderer stores only live presentation state. Native event messages are the source of truth; command failures leave the previous state unchanged.

F11 is handled in the keyboard resolver as a fixed action. It is not added to configurable action lists, settings normalization, settings export/import, or shortcut recording.

## Components and data flow

1. `useKeyboard` resolves F11 to `toggle-fullscreen` when running in desktop-capable runtimes, then prevents browser default handling.
2. `App` wires the action to `bridge.postMessage({ command: 'toggle-fullscreen' })` and subscribes to the existing host-message event path for `fullscreenChanged`.
3. The Settings dropdown receives the live fullscreen state and renders `Show full screen` below `Toggle Focus mode`; clicking it sends the same command.
4. WelcomePage’s Tab shortcuts data includes a non-configurable F11 row.
5. Electron and Tauri implement the command and emit state changes after native state transitions, including external enter/leave events where supported.

## Error handling

- Unsupported runtimes do not expose the Settings row and do not resolve F11 to the native action.
- Native API errors are logged using existing host conventions and do not optimistically flip UI state.
- Unknown host messages remain ignored by existing message handling.
- No persisted fallback state is created.

## Testing

- Unit-test fixed F11 resolution and desktop-runtime gating.
- Test Settings dropdown placement, label, `[F11]` tooltip, command dispatch, and live switch state.
- Test Homepage Tab shortcuts includes F11.
- Test Electron command toggles native state and emits state changes.
- Test Tauri dispatcher handles `toggle-fullscreen` and state emission.
- Run focused UI/native tests, then the repository’s full test suite and applicable build/type checks.

## Scope boundaries

- No new configurable `SettingModel` field.
- No persistence, settings import/export changes, or user-editable F11 binding.
- No browser Fullscreen API; fullscreen is native window fullscreen.
