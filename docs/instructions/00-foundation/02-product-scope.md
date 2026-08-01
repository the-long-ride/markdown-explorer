---
timestamp: '2026-08-01T22:54:00+07:00'
name: Product Scope
topic: Product goals, supported surfaces, and exclusions
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 03-actors-and-terminology.md
- 04-source-of-truth.md
source_scope:
- README.md
- package.json
test_scope: []
runtime_scope:
- shared
keywords:
- scope
- product
---

# Product Scope

## Product statement

Markdown Explorer opens local documentation workspaces and individual documents, renders Markdown and MDX safely, and provides navigation, search, preview, conversion, and desktop integration across multiple hosts.

## Supported application surfaces

| Surface | Primary use |
|---|---|
| Electron desktop | Full local workspace, native shell, tray, installer, updater |
| Tauri desktop | Native Rust host with local protocols and document conversion |
| VS Code extension | Documentation viewer integrated with editor workspaces |
| Chromium extension | Browser file-system handles and IndexedDB recents |
| Website app | Demo workspace and browser file mode |

## In scope

- Opening folders, individual files, recent workspaces, external paths, and dropped files.
- Workspace scanning, incremental reveal, watching, refresh, cancellation, and recovery.
- Sidebar, desktop workspace tabs, document tabs, TOC, history, and focus modes.
- Markdown/MDX rendering, code, tables/charts, math, Mermaid, media, and HTML preview.
- Current-document, workspace, and cross-workspace search.
- Preferences, keyboard shortcuts, themes, localization, onboarding, and persistence.
- Native window, tray, shell-location, updater, conversion, packaging, and release behavior.

## Explicit exclusions

- Cloud storage, collaborative editing, account management, and remote synchronization.
- Editing files inside the rendered viewer; editor opening is delegated to supported hosts.
- Unrestricted web execution in HTML previews.
- Chromium document conversion.
- Dead, unreachable, test-only, or planned behavior.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `README.md` | Active behavior or contract |
| Implementation | `package.json` | Active behavior or contract |

---

[← Documentation Governance](01-documentation-governance.md) · [Documentation index](../README.md) · [Actors and Terminology →](03-actors-and-terminology.md)
