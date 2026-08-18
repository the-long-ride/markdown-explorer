---
timestamp: '2026-08-18T17:30:00+07:00'
name: Current Application State
topic: Unreleased synchronized product and runtime snapshot
document_type: reference
status: active
ui_spec: true
parent_docs:
- ../README.md
related_docs:
- 03-settings-catalog.md
- 04-shortcut-catalog.md
- 10-localization-catalog.md
- ../04-runtimes/06-runtime-parity.md
- ../03-features/12-settings-preferences-import-export.md
- ../03-features/15-localization-welcome-onboarding.md
source_scope:
- ../../../ui/src
- ../../../electron
- ../../../tauri
- ../../../vscode
- ../../../chromium-xtension
- ../../../website-app
test_scope:
- ../../../tests/node/localization-settings-doc-sync-contract.test.mjs
runtime_scope:
- electron
- tauri
- vscode
- chromium
- web
keywords:
- current state
- unreleased
- settings
- typography
- localization
- shortcuts
- runtime parity
---

# Current Application State

This reference is the synchronized **Unreleased** snapshot of Markdown Explorer as of 2026-08-18. Feature, runtime, protocol, and catalog documents remain the normative detailed specifications; this page is the compact cross-product map used to detect documentation drift.

## Supported runtimes

Markdown Explorer shares the renderer across **Electron**, **Tauri**, **VS Code**, **Chromium**, and the website/browser-file runtime. The renderer capability-gates native actions rather than pretending every host owns the same filesystem, updater, window, editor, font, or zoom APIs.

| Capability | Electron | Tauri | VS Code | Chromium / Web |
|---|---|---|---|---|
| Workspace/folder browsing | Native desktop bridge | Native Tauri bridge | VS Code workspace APIs | Browser File System Access API where available |
| Edit current document | `Ctrl+E`, action in More Actions | `Ctrl+E`, action in More Actions | `Ctrl+Alt+E`, icon beside More Actions | Not exposed |
| Typography font sources | system fonts and imported `.ttf`/`.otf` | system fonts and imported `.ttf`/`.otf` | system fonts and imported `.ttf`/`.otf` | Imported `.ttf`/`.otf`/`.woff`/`.woff2` via IndexedDB & FontFace API |
| App-owned zoom | Yes | Yes | No; host/native zoom | No; host/native zoom |
| Update installation | Markdown Explorer desktop updater | Signed Tauri updater | VS Code owns installation; Markdown Explorer checks/reports only | Store/deployment owned |

VS Code imported fonts are copied to extension global storage and served to the webview with a webview-safe URI. Chromium extension and Web demo store imported font files in IndexedDB (`markdown-explorer-browser-fonts`) and activate them via blob URLs and the FontFace API. They customize Markdown Explorer only and do not mutate host editor or browser settings.

## Window, shell, and focus behavior

- Restored Electron and Tauri windows enforce a **800 px** minimum width; host-managed browser/extension windows keep host constraints.
- Desktop Settings uses `width: min(800px, 100vw - 32px)` so it stays bounded on narrow windows.
- Focus mode is an application-layout state, not an OS minimize operation. Entering focus mode hides the normal application chrome while retaining a dedicated exit control; toggling it restores the previous shell state.
- Desktop Tabs and Focus views preserve workspace/document navigation, content-tab state, aliases, and scroll memory according to the desktop workspace specifications.
- More Actions uses the compact menu-item density and splits toggle rows into discrete `menuitem` and `switch` elements. Desktop fullscreen uses the dedicated fullscreen icon.
- Update attention dots across navigation and action triggers are standardized to `--update-attention-dot-size: 11px`.
- **Reset zoom** is Markdown Explorer-owned only in Electron/Tauri desktop and defaults to **`Ctrl+Alt+Z`**. VS Code, Chromium, and Web use native host zooming and expose no Markdown Explorer reset-zoom action.

## Settings and preferences

Settings is organized into **Appearance**, **Typography**, **Theme Style**, **Keyboard Shortcuts**, and **Update & Backup**, with icons in the navigation rail and a description under every section title.

### Appearance

- Appearance renders Color Mode and preference controls directly under the section header.
- There is **no secondary `View Preferences` heading**.
- Existing view controls, including maximum pinned items, keep their persisted settings and localized descriptions.

### Typography

Electron, Tauri, VS Code, and Chromium/Web expose role-based Typography for **App UI, Body, Heading, Quote, Code, and Mermaid**. Each role stores source/family/import ID, style, and explicit numeric weight.

- System and imported fonts are searchable; `.ttf`, `.otf`, `.woff`, and `.woff2` imports bind to the initiating role's draft. Applying the Mermaid role re-renders visible Mermaid diagrams in the current document.
- `FontSearchDropdown` calculates boundary-aware positioning against scroll containers and viewport edges to flip upward or downward flush against trigger buttons without gaps or clipping.
- Typography's header and Apply action remain fixed while the role list owns its scrolling region.
- The Apply action is disabled until the draft differs from persisted bindings.
- Applying opens a confirmation dialog listing only changed roles as old → new values; Cancel leaves the draft untouched.
- The action-level circle-check Apply icon is a component-owned **14 px × 14 px** box in every theme. The dialog's decorative confirmation icon is intentionally larger.
- Reset/remove/import actions share the Settings outline-button behavior and tooltip conventions.

### Theme Style and Theme Remix

- Theme lists stay attached to their trigger with collision-aware vertical placement (opening flush downward or upward without mid-air gaps), display at most seven visible rows, and scroll beyond that limit.
- Theme Style content is centered within its section.
- Custom Theme Remix supports layout/density/background/color controls, custom-theme limits, and localized status feedback.
- Theme-specific CSS may change colors/radii but must not override component-owned action-icon geometry.

### Keyboard Shortcuts

- Shortcut controls show active bindings with shared keycap rendering in tooltips and Settings.
- Shortcut enabling/disabling utilizes the shared accessible `SwitchButton` component (`app-switch`).
- The Settings close tooltip renders **Esc as the shared keycap component**, not literal `(Esc)` text.
- Edit is runtime-specific: Electron/Tauri default to `Ctrl+E`; VS Code defaults to `Ctrl+Alt+E`; Chromium/Web expose no Edit action.
- Reset zoom defaults to `Ctrl+Alt+Z` only on Electron/Tauri desktop.
- Runtime normalization removes unsupported imported bindings instead of exposing dead actions.

### Update & Backup

- Desktop/Tauri can check, download, defer, restart/apply, and skip notification for one normalized release version according to updater capabilities.
- VS Code can check/report a newer Markdown Explorer extension version, but Markdown Explorer does not download or install it; VS Code owns extension updates.
- The update-available dialog uses the glow icon, shows the changelog link below the version in the header, and uses shared outline actions for Later/Skip.
- Import/Export JSON remains the settings portability mechanism for supported persisted preferences.

## Documents, tables, and navigation

- Markdown/MDX is the core document surface, with local rendering, code blocks, math, Mermaid, media handling, links, heading navigation, table of contents, and collapsible sections.
- Supported file/conversion behavior is defined by the Supported Files and Conversion catalog and is capability-gated by runtime.
- Sidebar navigation includes Files, Search, and opt-in Bookmarks with filtering, sorting, pinning, cursor-mode keyboard navigation, current-file location, and workspace scoping. Sidebar navigation ARIA text and pin/sort/search status labels come from the active locale without component-owned English fallbacks.
- The per-row pinned-item indicator uses the stroke-only `PinIcon` (Lucide thumbtack, size 12). Both unpin affordances — the per-item context-menu entry and the toolbar Clear Pins button — render the same `UnpinIcon` (Lucide thumbtack + diagonal slash overlay); `ClearPinsIcon` delegates to `UnpinIcon` so the slash stays in sync without SVG-path duplication.
- Search covers the current document/current workspace and desktop cross-tab modes where supported; status labels and accessibility text are localized.
- Desktop document tabs preserve active document and scroll state; context actions and their shortcut labels use translated copy. Recent-workspace `last opened` values use `Intl.RelativeTimeFormat`/`Intl.DateTimeFormat` with the selected application locale.
- The Media Modal viewer exposes a light/dark theme toggle in its footer toolbar that re-renders the displayed Mermaid diagram with the new theme palette while preserving the current zoom/pan transform. The toggle's keyboard shortcut (`toggleTheme`) fires through the modal's keyboard gate; all other global shortcuts remain muted while the modal is open.

### Interactive tables, filters, and charts

Interactive tables in rendered Markdown and delimited files support sorting, searching, column value filtering, text wrapping, column visibility management, and rich chart visualizations:

- **9 Chart view types**: **Table**, **Bar Chart**, **Horizontal Bar Chart**, **Line Chart**, **Area Chart**, **Scatter Chart**, **Radar Chart**, **Polar Area Chart**, **Pie Chart**, and **Doughnut Chart**.
- **Scatter Charts**: Require at least two visible numeric columns; the first numeric column is mapped to the X-axis while subsequent numeric columns become independent Y series.
- **Column Visibility**: Per-table **Columns** dropdown menu with switch toggles for each column, a **Show all** action, and a guard preventing the last visible column from being hidden.
- **Dynamic Sizing**: The table view selector intrinsically sizes to the widest localized option via an offscreen sizer element.
- **Fullscreen Chart Modal Viewer**: Click-to-enlarge chart modal with **50% to 1000% continuous zoom**, mouse drag & touch pan, **Fit to Screen**, **Reset Zoom**, modal type switcher, **Copy as Image** (raster PNG clipboard copy with font rendering), and **Save as Image (.PNG)** via native host dialog (`saveChartPng` on Tauri) or browser download.
- **CSP Event Delegation**: Chromium extension delegates table column toggle and view selection clicks in `useContentEffects` and `SearchDocumentPreview` to comply with Manifest V3 Content Security Policy restrictions.

## Onboarding, welcome, and localization

Markdown Explorer currently ships **nine supported locales**: English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian.

The localization boundary covers normal visible text plus accessibility labels, placeholders, dialog copy, tooltip copy, status feedback, shortcut action names, onboarding/terms, workspace selection, Theme Remix, Welcome/Tips, initial loading/scanning states, sidebar navigation, recent-workspace time formatting, search On/Off state, and Settings shell text. The audited translation domains are `ui`, `terms`, `onboarding`, `workspaceSelection`, `themeRemix`, and `rendererUi` in `auditedUiTranslations.ts`, while established feature-specific groups remain in the main translation catalog. `rendererUi` also travels through Markdown rendering so table filtering, row counts, wrapping, column visibility, chart switching, chart modal viewer actions, copy feedback, code/preview controls, and video/YouTube fallback labels stay in the selected locale after DOM updates.

The dependency-free localization contract guards audited user-facing literals across React and generated Markdown/DOM code so new component-owned English fallbacks are caught before release. Technical identifiers remain intentionally literal when translation would change their meaning: commands, key IDs, CSS variables, URLs, `chrome://flags`, `brave://flags`, `File System Access API`, file extensions, and product/project brand names.

## Persistence and safety

- Settings, recent workspaces, themes, bookmarks, tabs, and runtime-owned handles use the persistence layer documented in the Storage Catalog.
- Browser file handles stay browser-owned; desktop filesystem access stays behind native bridges.
- External navigation and local HTML/media access follow the runtime security boundaries instead of granting arbitrary renderer filesystem access.
- Imported font files are managed within the owning desktop/VS Code runtime or browser IndexedDB rather than exposing unrestricted renderer paths.

## Documentation synchronization rule

When an implementation change alters a capability, default shortcut, Settings behavior, runtime difference, persisted field, translation boundary, or operational limit, update the matching feature/runtime/reference specification **and this current-state snapshot in the same change**. `CHANGELOG.md` records the user-visible result under **Unreleased** until a version is cut.

## Primary source-of-truth documents

- [Tables, Filters, Sorting, and Charts](../03-features/08-tables-filters-charts.md)
- [Settings and Preferences](../03-features/12-settings-preferences-import-export.md)
- [Settings Catalog](03-settings-catalog.md)
- [Keyboard Shortcut Catalog](04-shortcut-catalog.md)
- [Localization Catalog](10-localization-catalog.md)
- [Runtime Parity](../04-runtimes/06-runtime-parity.md)
- [Localization, Welcome, and Onboarding](../03-features/15-localization-welcome-onboarding.md)
- [Source Traceability Index](12-source-traceability-index.md)

