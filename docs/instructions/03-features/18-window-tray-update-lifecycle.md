---
timestamp: '2026-08-05T06:40:23+07:00'
name: Desktop Window, Tray, Startup, and Update Lifecycle
topic: Desktop Window, Tray, Startup, and Update Lifecycle
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- electron/core/main-bootstrap.js
- electron/core/startup-workspace.js
- electron/window/window.js
- electron/window/tray.js
- electron/update/update-manager.js
- tauri/tauri.conf.json
- tauri/src/core/bootstrap.rs
- tauri/src/update/manager.rs
- tauri/src/dispatcher/commands_window_update.rs
- scripts/configure-tauri-updater.mjs
- .github/workflows/release.yml
test_scope:
- tests/unit/electron/main.test.ts
- tests/unit/electron/tray.test.ts
- tests/unit/electron/window.test.ts
- tests/node/packaged-runtime-contract.test.mjs
- tests/node/tauri-updater-contract.test.mjs
runtime_scope:
- electron
- tauri
- other-hosts
keywords:
- desktop window, tray, startup, and update lifecycle
---

# Desktop Window, Tray, Startup, and Update Lifecycle

## Feature intent

Define single-instance startup, external-path queue, frameless controls, native window state, tray behavior, platform close lifecycle, and updater capability/state.

## Capability contract

| Capability | Required behavior | User result |
|---|---|---|
| Single instance | Focus existing app and queue new external targets. | One coherent process owns state. |
| Window controls | Minimize, maximize, close, fullscreen, zoom. | Frameless desktop remains controllable. |
| Tray | Open/focus and explicit Quit. | Desktop app can remain accessible. |
| Platform lifecycle | Apply macOS vs non-mac window-close behavior. | OS conventions are respected. |
| Updater | Gate download/schedule/apply by package capability; preserve matching Electron/Tauri choices and states. | Supported installations update safely. |

## Interaction and processing flow

```mermaid
flowchart LR
    A[User input or host event] --> B[Validate and normalize]
    B --> C[Update application state]
    C --> D[Render or dispatch host command]
    D --> E[Announce result or recover error]
```

### Electron lifecycle

- Acquire single-instance lock.
- Remove standard menu for frameless shell.
- Queue startup/external paths until UI readiness.
- Tray click/Open restores and focuses; Quit terminates.
- Non-macOS quits when all windows close; macOS remains and recreates on activate.
- In-app installation is limited to installed packaged Windows builds, excluding portable.

### Tauri window baseline

1280×800 default, 800×480 minimum, frameless, restored state, single-instance/file-drop integration, and configured updater support only when deployment keys/endpoints are valid.


## Tauri signed updater lifecycle

- Initialize `tauri-plugin-updater` and `tauri-plugin-process` during bootstrap.
- Check endpoint metadata and require an exact requested-version match.
- Download through the plugin so signatures are verified before staging.
- Emit bounded progress and persist downloaded/scheduled state with staged bytes.
- **Update on Close** intercepts the close request, installs the scheduled artifact, then restarts.
- **Restart Now** installs a downloaded artifact immediately, then restarts.
- After relaunch, reconstruct the `Update` descriptor from the endpoint and reuse persisted verified bytes.
- Failed installation restores retryable staged state and leaves the current app usable.

## States and failure behavior

| State | Required presentation | Exit condition |
|---|---|---|
| Starting | Single-instance/startup target | Ready/error |
| Visible | Window active | Minimize/hide/close |
| Tray-only | Process active/window hidden | Open/Quit |
| Fullscreen/maximized | Host state emitted | Restore |
| Update states | Idle through error | Download/schedule/apply |

## Runtime behavior

| Runtime | Specification |
|---|---|
| Electron | Full lifecycle described above. |
| Tauri | Native window/local protocol/updater configuration. |
| Other hosts | Editor/browser distribution owns window/update lifecycle. |

## Non-functional requirements

- All actions remain keyboard reachable.
- A failed enhancement must not prevent the base document from rendering.
- Host-facing inputs are validated before filesystem, shell, or network access.


## Acceptance criteria

- [ ] Second-instance path reaches the existing ready UI exactly once.
- [ ] Tray Quit exits.
- [ ] Host events are authoritative for maximized/fullscreen UI.
- [ ] Unsupported builds hide installer controls.
## UI reference implementation

The sample shows the interaction boundary, not a replacement for the React implementation.

```html
<section class="spec-desktop-window-tray-startup-and-update-lifecycle" aria-labelledby="desktop-window-tray-startup-and-update-lifecycle-title">
  <h2 id="desktop-window-tray-startup-and-update-lifecycle-title">Desktop Window, Tray, Startup, and Update Lifecycle</h2>
  <p data-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-action>Minimize window</button>
</section>
```

```css
.spec-desktop-window-tray-startup-and-update-lifecycle {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  background: var(--surface);
  color: var(--text);
}
.spec-desktop-window-tray-startup-and-update-lifecycle button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

```javascript
const root = document.querySelector('.spec-desktop-window-tray-startup-and-update-lifecycle');
const status = root.querySelector('[data-status]');
root.querySelector('[data-action]').addEventListener('click', () => {
  window.PlatformBridge.postMessage({ command: 'window-minimize' });
  status.textContent = 'Request sent';
});
```
## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `electron/core/main-bootstrap.js` | Active behavior or contract |
| Implementation | `electron/core/startup-workspace.js` | Active behavior or contract |
| Implementation | `electron/window/window.js` | Active behavior or contract |
| Implementation | `electron/window/tray.js` | Active behavior or contract |
| Implementation | `electron/update/update-manager.js` | Active behavior or contract |
| Implementation | `tauri/tauri.conf.json` | Active behavior or contract |
| Implementation | `tauri/src/core/bootstrap.rs` | Plugin setup and close interception |
| Implementation | `tauri/src/update/manager.rs` | Verified download, persistence, install, restart |
| Implementation | `tauri/src/dispatcher/commands_window_update.rs` | Electron-compatible updater commands |
| Implementation | `scripts/configure-tauri-updater.mjs` | Public-key release configuration |
| Implementation | `.github/workflows/release.yml` | Signed updater artifacts and signatures |
| Verification | `tests/unit/electron/main.test.ts` | Automated expectation |
| Verification | `tests/unit/electron/tray.test.ts` | Automated expectation |
| Verification | `tests/unit/electron/window.test.ts` | Automated expectation |
| Verification | `tests/node/packaged-runtime-contract.test.mjs` | Automated expectation |
| Verification | `tests/node/tauri-updater-contract.test.mjs` | Official plugin, state parity, and artifact-signing contract |

---

[← Context Menus, Shell Locations, Links, and Editor Actions](17-context-menus-shell-links.md) · [Documentation index](../README.md) · [Errors, Recovery, Status, and Observability →](19-errors-recovery-observability.md)
