# Changelog

All notable changes to the **Markdown Explorer** extension will be documented in this file.

> **Note:** This changelog is maintained independently from the root [`CHANGELOG.md`](../CHANGELOG.md). It covers only VS Code extension-specific changes. For desktop (Electron/Tauri), Chromium extension, and web releases, see the root changelog.

## [v1.6.7] — 2026-09-06

### Added
- **Workspace Insights Panel & Six Specialized Views**: Added an offline-first workspace auditing and exploration panel accessible via the More actions menu or `Ctrl+Alt+I`:
  - **Gallery**: Visual grid indexing all referenced media (images, diagrams, video, audio, documents) with Mermaid diagram thumbnail rendering, category filtering, search, and safe remote preview gates.
  - **Links**: Workspace reference auditing surfacing broken links, missing targets, invalid anchors, outside-workspace files, dynamic references, ambiguous Wiki Links, and optional host-backed external HTTP checks.
  - **Lint**: Fast Markdown diagnostics checking heading level jumps, duplicate headings, malformed frontmatter, unaligned table delimiters/columns, and inconsistent list indentation, with finding/rule/path-level suppressions.
  - **Duplicates**: Exact duplicate, repeated section/passage, and near-duplicate document analysis with configurable similarity threshold (50%–100%) and group-level suppression.
  - **Graph**: Interactive document relationship network graph with backlink traversal, 1st and 2nd degree neighborhood highlighting, node search, continuous zoom controls, and fullscreen mode.
  - **Related Documents**: Deterministic related document ranking powered by direct links, shared tags, shared headings, title terms, and terminology overlap with explicit evidence breakdowns.
- **Wiki Links & Transclusion Engine**:
  - Full support for Wiki Link syntax (`[[Note]]`, `[[Note#Heading]]`, `[[Note|Label]]`, `[[#Heading]]`, and relative forms `[[./Local]]`).
  - Transclusion embeds (`![[Note]]`, `![[Note#Heading]]`, `![[image.png]]`) with cycle detection and depth limit guards.
  - Smart fragment navigation auto-expanding collapsed parent headings and scrolling accurately after target document render.
- **Community Support & Appreciation Prompt Modal**:
  - Periodic support modal prompting users to star on GitHub or donate after 2 hours of accumulated usage, recurring every 24 hours.
  - Custom accessible SVG icons replacing native checkboxes with a "Don't show this again" option.
  - Development debug mode flag propagation in `panelShell.ts`.
  - Complete translations for support prompt strings across all 9 supported languages.
- **Workspace Insights Shortcut (`Ctrl+Alt+I`)**:
  - Default keyboard shortcut `Ctrl+Alt+I` assigned to `toggleWorkspaceInsights` in the VS Code webview panel.
  - Fully integrated with Settings keyboard shortcut configuration and the homepage Shortcuts overview tab.
- **Nine-Locale Localization**:
  - Complete translations across all 9 supported languages (English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, Russian) for all Workspace Insights UI copy, settings sections, tuning limits, unit notes, search placeholders, graph controls, empty states, and presentation categories.

### Changed
- **Workspace Insights UX Polish**:
  - Unified header layout into a single row containing title, polite indexing status, refresh, settings toggle, and close buttons.
  - Enforced a minimum panel width of 390px (resizable up to 760px) with keyboard arrow-key resize support.
  - Styled all filter chips, status badges, and tab counters with theme-aware border radiuses matching Tokyo Night, Glass Bento, Neon Voltage, Raw Grid, Vercel, and custom themes.
  - Added clear unit notes `(ms)`, `(%)`, `(nodes)`, `(MB)` to numeric tuning inputs in Insights Settings.
  - Prevented tooltip clipping by rendering action tooltips via portals above scrollable panel content.

### Fixed
- **Scope View Modal Event Race Conditions**: Bound DOM and input listeners in `useLayoutEffect` to eliminate event listener registration race conditions.
- **Tooltip Viewport Clipping**: Fixed action tooltips getting clipped by overflow containers in the Workspace Insights panel.

---

## [v1.6.6] — 2026-08-24

### Added
- **Export Center & Feature-Driven Offline Export**: Integrated full Export Center modal supporting **HTML**, **Static Website (ZIP)**, and client-side hybrid **PDF** generation.
  - **Source Scopes**: Export Current Document, Selected Files (with search filtering & checkboxes), Folder, or Whole Workspace with automatic referenced asset resolution via `panelExportResources.ts` (`readWorkspaceExportResource`).
  - **Layout & Batch Modes**: Document-only vs. Full Explorer viewport shell; Separate files vs. Single merged document with collision-safe anchors.
  - **Offline Runtimes**: Packaged feature runtimes for core interactions, sandboxed HTML iframe previews with auto-resizing, media modal viewer, table filtering/sorting, and interactive Chart.js visualizations.
  - **File Saving**: Native file saving via VS Code save dialogs handled by `panelExportSave.ts` (`saveExportFile`).
- **Scope View Modal**: Non-navigating workspace document snapshot preview modal for deep inspection of linked documents without losing current editor or tab position.
  - **Isolated Navigation History**: 10-step history stack (`MAX_SCOPE_DEPTH=10`) with animated depth segment indicators, Prev/Next navigation, and maximum-depth guard.
  - **Open File Button**: Dedicated **Open file** button (`OpenFileIcon`, 13px geometric precision external-open SVG) navigates the main workspace to the previewed document and closes the modal.
  - **Link Context Menu**: Right-click any document link and select **Open as scope** to preview it immediately.
- **Universal Hardware & Keyboard Navigation**:
  - Logitech and hardware mouse back/forward buttons (buttons 3 and 4) along with `BrowserBack`/`BrowserForward` keys and `Alt+ArrowLeft`/`Alt+ArrowRight` shortcuts provide seamless history navigation in both the main document viewer and Scope View modal.

### Changed
- **Export Center — Streamlined Document-First Export**: Removed the **Additional workspace files** panel and host-level `listWorkspaceExportResources` enumeration (`listPanelExportResources` deleted, `readPanelExportResource` retained) in favor of automatic referenced asset packaging.
- **Export Center — Multi-Select Flex Layout**: The selected-documents `export-multi-select` fills the remaining height of its parent container (`sources:has(.export-multi-select)` flex column, `multi-select` `flex:1; min-height:0`, `rows` `flex:1; min-height:0; overflow:auto`) with responsive fallbacks.
- **Scope View — Header Styling & Close Button Unified**: Header close `×` button unified with Settings modal (`settings-card__close`, 22px, `opacity: 0.6` → `1` with `scale(1.1)` hover) with consistent header padding (`6px 24px 6px 10px`).
- **Mermaid Lifecycle & Content Rendering Parity**: Clean separation of Content effects and Mermaid rendering lifecycle with offscreen scratch container attached to `document.body` during `mermaid.run()`, ensuring accurate dimensions for all diagram types.

### Fixed
- **Mouse Back/Forward Button Navigation**: Fixed mouse buttons 3 and 4 failing to navigate document history.
- **Mermaid Layout-Sensitive Diagram Rendering**: Fixed degenerate/zero-dimension rendering on initial load for layout-sensitive Mermaid diagrams (sequence, packet, kanban, pie, quadrant, xychart, zenuml, sankey).

---

## [v1.6.5] — 2026-08-18

### Added
- **Media Modal Light/Dark Theme Toggle**: Added a SunIcon/MoonIcon button to the Media Modal viewer footer toolbar that flips the global app theme and re-renders the displayed Mermaid diagram with the new palette without disturbing zoom/pan state. The re-render `useEffect` defers the helper call to a `queueMicrotask` so the parent `useAppStateEffects` theme-sync has already applied `dataset.theme` and the new CSS custom properties before the helper reads them.
- **Mermaid Categorical Soft-Fill Palettes**: Mermaid theme now builds soft categorical fills cycling `chart1`..`chart6` tokens with surface mixing for consistent low-saturation series backgrounds across flowchart classes, pie slices, and quadrant zones.
- **Sidebar Pinned-Icon Tap Target & Unpin Affordance**: The per-row pin button grows from 10 to 12 for tap-target parity, and the unpin affordance is rewritten as a dedicated `UnpinIcon` (Lucide thumbtack + diagonal slash) inheriting the active theme accent via `currentColor`.

### Changed
- **Unified Unpin Icon Design**: The sidebar toolbar's "clear all pins" button now delegates to `UnpinIcon` so both unpin affordances (per-item menu and clear-all toolbar) render the same Lucide thumbtack + diagonal slash. Replaces the prior 512×512 filled silhouette with the red `#EF4136` accent.

### Fixed
- **Mermaid empty box on modal open until zoom/pan**: `renderMermaidToSvg` now appends its scratch node to a hidden off-screen host on `document.body` before `mermaid.run()` so layout-sensitive diagram kinds (sequence, packet, kanban, pie, quadrant, xychart, zenuml, sankey) measure correctly. The modal also skips the first dep-change per new gallery open, preserving the good `createMediaGallery` snapshot.
- **Mermaid did not recolor on theme flip inside media modal**: The re-render effect wraps the helper call in `queueMicrotask` so `useAppStateEffects` has applied `dataset.theme` before the helper reads CSS custom properties; a narrowed `const source = current.source` is captured before the closure for TypeScript narrowing.
- **Toggle-theme keyboard shortcut muted inside media modal**: The `toggle-theme` keyboard matcher is now lifted above the `isModalOpen` guard so users can flip light/dark while the image/SVG modal is open. Other global shortcuts remain muted; the terms dialog still captures the same shortcut.

---

## [v1.6.4] — 2026-08-16

### Added
- **Expanded interactive table chart suite**: Added six new chart visualizations alongside Bar and Line charts: **Horizontal Bar Chart**, **Area Chart**, **Scatter Chart**, **Radar Chart**, **Polar Area Chart**, and **Doughnut Chart**. Scatter charts intelligently map the first numeric column to the X-axis and remaining numeric columns as separate Y series datasets.
- **Table column visibility management**: Added a dedicated per-table **Columns** toolbar dropdown menu with accessible switch toggles to show/hide individual columns, a **Show All** shortcut, and a last-visible-column guard preventing accidental hiding of all columns.
- **Interactive chart modal viewer**: Built a fullscreen modal viewer for interactive table charts featuring **50% to 1000% continuous zoom**, mouse drag and touch pan navigation, **Fit to Screen**, **Reset Zoom**, an in-modal chart type switcher, **Copy as Image** (raster PNG clipboard copy), and **Save as Image (.PNG)** via browser download.
- **Shared accessible switch component**: Added a reusable `SwitchButton` component (`app-switch`) with full ARIA switch semantics, unifying switch controls across Settings Shortcuts, Toolbar Action Menu toggles, and Table Column visibility menus.
- **Edit Current Document Shortcut**: Added `Ctrl+Alt+E` / `Cmd+Alt+E` keyboard shortcut to open the active previewed file directly in a normal VS Code editor tab.

### Changed
- **ToolbarActionMenu accessibility & structure**: Split composite menu items into discrete action buttons (`role="menuitem"`) and switch toggles (`role="switch"`), eliminating `menuitemcheckbox` ambiguity for screen readers and keyboard users.
- **Table view dropdown dynamic sizing**: Implemented an offscreen sizer element for `.mdn-table-view-dropdown` to dynamically compute minimum trigger width based on the widest localized chart type option, preventing label truncation across locales.
- **Font search dropdown position calculation**: Added boundary-aware viewport and scroll-container calculation in `FontSearchDropdown` to smoothly flip upward or downward flush to the anchor without offscreen clipping or gaps.
- **Standardized update attention indicator token**: Unified update attention dot sizing across topbar action menus and Settings navigation rail using `--update-attention-dot-size: 11px`.
- **Media modal layout refinement**: Polished media viewer footer layout, container structure, and standardized close button icon sizing to 16 px.
- **Nine-locale table & chart translations**: Added comprehensive translations for all new chart types, column controls, and chart modal viewer actions across English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian.

### Fixed
- **Chart.js controller registration**: Expanded Chart.js bundle initialization in `renderLibs.ts` to register `Filler`, `PieController`, `PolarAreaController`, `RadarController`, `RadialLinearScale`, and `ScatterController` with zero lazy-loading regressions.
- **Table chart wrap and column toggle tooltips**: Added localized aria-labels and app tooltips to table wrap toggle and column toggle buttons.
- **Theme Style dropdown positioning**: Computed menu height dynamically based on item count and anchored upward-opening menus flush against trigger buttons with `bottom` placement, eliminating large blank gaps above theme cards.

---

## [v1.6.3] — 2026-08-04

### Added
- **Source-Anchored Bookmark Targets**: Upgraded bookmark storage to schema version 2 with deterministic legacy migration, exact Markdown source ranges, fingerprints, contextual relocation, object identity, and occurrence tracking. One bookmark can span multiple lines and mixed Markdown formatting, code, symbols, and punctuation; complete LaTeX, Mermaid, image, and link objects can be saved from their context menus. Repeated content resolves to the saved occurrence, while uncertain edited targets report **Target changed** instead of jumping incorrectly.
- **Bookmark Sidebar Batch Workflow**: Widened the Bookmarks navigation surface, added a live saved-count badge, aligned search and toolbar rows, replaced bookmark/edit/group controls with theme-aware SVGs, and added checkbox selection mode with confirmed batch deletion. VS Code uses `Alt+Shift+B`.
- **Searchable User Manual**: Added a translated, task-oriented User manual as the second Home tab, with instant local search, platform-aware shortcut examples, progressive guidance sections, and direct actions for Workspace, Search, Bookmarks, and Settings.
- **Persistent Bookmarks**: Added an opt-in Bookmarks setting and sidebar tab. Users can save selected document text with a custom name, search/sort saved items, rename/delete through three-dot or right-click menus, and jump back with search-style highlighting. Tabs view groups bookmarks by every open workspace; Focus view lists only the current workspace. Bookmark data persists independently from settings.
- **Bookmark Localization and Coverage**: Added all bookmark labels, dialogs, empty/error states, and actions in English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian, with dependency-light model, persistence, UI, navigation, and manifest tests.
- **Featured Random Tip Card in Active Workspace**: When a user has an active workspace open but closes all document tabs/files, a featured **Random Tip Card** from the Tips & Practices collection is randomly chosen and displayed prominently in the center of `content__scroll`, complete with 3D keycaps and interactive shuffle controls.
- **Dynamic 3D Keycaps & Theme Synchronization**: All keyboard shortcuts rendered in tooltips, Settings Modal, and the Welcome Page ("Tips & Practices" tab) now render as 3D keycaps with bevel depth, top lighting gradient, and 3D drop shadow.
- **Theme-Adaptive Keycap Styling**: Keycap surface colors (`color-mix` of `--bg-e` & `--accent`), drop shadows, and corner rounding (`border-radius: clamp(0px, var(--r, 6px), 10px)`) dynamically adapt to match the active theme (e.g., sharp technical keycaps in Raw Grid, rounded keycaps in Bento/Pet themes, translucent glass keycaps in Glass).
- **Embedded Tooltip Shortcut & Continuous Text Layout**: Tooltip descriptions parse embedded shortcuts (wrapped or bare like `Ctrl+Alt+T`) and format keycaps inline with `display: inline` sentence text flow without right-margin displacement.
- **Cross-Workspace Search & Live Document Preview**: Full Markdown and HTML document preview panel integrated directly into the Search Overlay modal with support for syntax highlighting, math, diagrams, CSV/TSV table views, and workspace scan scoping.
- **Files Tab Right-Click Context Menu**: Users can now right-click any item in the Files sidebar tab to open the same context menu that previously required clicking the three-dot (⋯) button, matching expected OS file-manager behaviour.
- **Collapse/Expand Document Section Tooltips**: The collapse-all and expand-all heading section buttons in the document title bar now show descriptive tooltips ("Collapse all sections" / "Expand all sections") on hover.
- **Welcome Page — Desktop App Download Hyperlink**: The "For the best experience, we recommend using the Desktop App" recommendation text now renders the locale-specific app name as a clickable hyperlink to the download page. The link text is translated in all 9 supported locales.
- **More Actions Tooltip Centering**: Tooltips inside the More Actions dropdown are now centered horizontally on their trigger button (changed from left-aligned) and capped to prevent viewport overflow on narrow screens.

### Changed
- **Bookmark Setting and Shortcut Reset Styling**: Renamed the switch to **Enable Bookmark feature**, expanded its translated description to cover mixed-format/multiline and object targets, and changed Reset Shortcuts to a solid warning-theme action while preserving confirmation and keyboard focus.
- **Vercel & Tokyo Night Theme Sidebar Alignment**: Left sidebar (`.sidebar`) and right TOC sidebar (`.toc-panel`) padding in Vercel and Tokyo Night themes updated to `padding: 8px 10px 10px 10px` with a floating `10px` bottom margin inset, matching topbar header left/right alignment.
- **K-Ink Wolf & Pet Theme Rail Markers**: Renamed `ui/src/assets/themes/pets/paws/` to `ui/src/assets/themes/pets/rail-markers/` with species-tailored SVGs (Cat with longer curved claws, K-Ink wolf with neat short claws, Hamster, Corgi, White Shiba).
- **Shortcut Label Typography**: Increased font weight (`font-weight: 600`, `12.5px`) and color contrast for shortcut action labels in Settings Modal for clear, effortless legibility.
- **Manual Tests Directory**: Renamed root `test/` folder to `manual-tests/` and updated virtual workspace import globs (`manual-tests/*.{md,mdx}`) and contract tests.
- **Sidebar Pinning — Root Level Hoisting**: When a file or folder located inside a parent subfolder is pinned, it is now hoisted and displayed directly at the root level of the sidebar tree instead of remaining nested inside its subfolder.
- **Unpinned Button Icon**: Updated unpinned item menu and clear-pins actions to use a dedicated dual-path SVG (`UnpinIcon`) with support for the active theme accent color (`var(--accent, #EF4136)`).
- **Search Overlay — Theme-consistent UI**: Standardized all search overlay button border radii (`border-radius: var(--r)`) to match the active theme across all variants. The close modal button is now borderless. Search result rows also use `var(--r)` to align with the theme's rounding style.
- **Search Overlay — Unified input row height**: Standardized `.search-overlay-input`, case-toggle, and preview-toggle button heights to `32px` across all themes for a uniform input row.
- **Scrollbars — Theme-consistent radius**: All app scrollbar thumbs (sidebar, TOC, code blocks, search overlay, settings) now use `var(--r-s, var(--r))` for border-radius, matching the active theme. The Raw Grid theme forces square `0px` scrollbar thumbs via `!important` overrides.
- **Heading section chevron — 3D Vertical Flip animation**: The collapse/expand chevron button now performs a vertical 3D flip (`rotateX(180deg)` with `cubic-bezier(0.25, 0.46, 0.45, 0.94)`) along the horizontal X-axis on toggle instead of spinning in 2D space. Initial state is applied without a CSS transition to prevent a spin-on-load artifact.
- **Sidebar Sort Menu**: Sidebar Files and Bookmarks sort menus now offer four options — **Name A → Z**, **Name Z → A**, **Recent changed**, and **Oldest changed** — with SVG sort-direction icons as status indicators, translated in all 9 supported locales.
- **Sidebar Minimum Width**: Increased the left sidebar minimum drag width to **300 px**.
- **Keycap Style — Retro Flat**: Replaced gradient 3D keycap rendering with a flat retro design: solid background, 2px bottom border for depth, no gradients or glow.

### Fixed
- **Sidebar Tab Compatibility Hooks**: Restored stable Files/Search/Bookmarks modifier classes and indicator state classes after the dynamic-width tab refactor, fixing active-state, click-dispatch, and moving-indicator UI regressions without changing the fit-content layout.
- **Bookmark Renderer and Test Parity**: VS Code now consumes the shared bookmark-aware Markdown renderer, while parser/renderer tests compare stable semantic output without treating source-anchor metadata as a visual regression. Sidebar fixtures remain compatible when bookmarks are disabled, and the new source files are registered in the coverage manifest.
- **Verified Object Bookmark Saves**: Fixed image and link bookmarks that could open a redundant second menu or silently fail to persist. The existing context menu now opens one naming dialog directly, save and rename verify persistence before success, Mermaid entrypoint nodes supply default diagram names, and translated green success/red error toast feedback reports every result.
- **Focus-Aware Sidebar Search and Tab Layout**: Sidebar tabs now fit their icon and label, share one smooth indicator/panel transition, and use equal search-field heights. Files scope controls occupy row two; workspace search excludes unfocused files and changing focus reruns the existing query immediately.
- **Electron Builder NSIS Script Compilation**: Added `!include "MUI2.nsh"` in `electron/build/installer.nsh` to resolve missing `MUI_HEADER_TEXT` macro error during `pnpm run build:electron` installer packaging.
- **Search Overlay — Preview renders only once per scan**: The `SearchDocumentPreview` component was re-fetching the preview on every incremental search batch because the `item` object reference changed each time the results array was rebuilt. Fixed by:
  - Memoizing `selectedResult` in `SearchOverlay` keyed on `selectedResultKey` so the object reference is stable across batches.
  - Removing `item` from the fetch `useEffect` dependency array in `SearchDocumentPreview`, accessing it via a ref so only `itemKey` (the file path) triggers a new fetch.
  - Wrapping `SearchDocumentPreview` with `React.memo` to shield it from parent re-renders entirely.
- **VS Code Extension Activation — CommonJS Module Fix**: Restored `module: "commonjs"` in `vscode/tsconfig.json` and enabled `rewriteRelativeImportExtensions: true`. Switching to ESM output caused silent activation failure (`command 'markdownExplorer.open' not found`) because the VS Code Extension Host uses `require()` which cannot load ES module syntax.

---

## [v1.6.2] — 2026-07-30

### Added
- **VS Code Open Folder Context Menu**: Added right-click context menu option `Open Folder in Markdown Explorer` (`markdownExplorer.openFolder`) for any folder in the VS Code Explorer file tree.
- **Settings Update Notification Badge**: Added an update notification dot badge to the Settings option button inside the More Actions menu when a new release version is available.
- **Customizable Refresh & TOC Keyboard Shortcuts**: Refresh action is now customizable in Settings modal and listed in Homepage > Shortcuts tab across all runtimes (`F5` on Desktop app, `R` on Web Demo, VS Code extension, and Chromium extension; `Ctrl+T` for Toggle TOC in Desktop app).

### Changed
- **Default Keybindings**: Updated default keyboard shortcut for Toggle TOC in Desktop app to `Ctrl+T`. Optimized HTML document, CSV/TSV table views, and workspace scan controls.

### Fixed
- **VS Code Extension VSIX Runtime Packaging**: Unignored compiled `out/` and `ui/dist/` assets in `vscode/.vscodeignore` and added `verify-package-runtime.js` to ensure runtime entrypoint (`extension.js`) is included in `.vsix` packages, resolving `command 'markdownExplorer.open' not found`.
- **Table of Contents Top Alignment**: Adjusted `TableOfContents.tsx` and `useContentEffects.ts` jump scrolling so clicked TOC items and hash anchors scroll with `block: 'start'`, aligning section titles to the top of `content__scroll`.
- **Table Toolbar UI Alignment**: Standardized `height: var(--control-h, 26px)`, `box-sizing: border-box`, padding, and vertical alignment across table search input, row count, wrap button, and display type dropdown switcher.

## [v1.6.1] — 2026-07-29

### Added
- **Keyboard Shortcut Search**: search field in the keyboard shortcuts section of the Settings modal for fast shortcut discovery.
- **Keyboard Shortcuts — Close Tabs**: configurable shortcuts to close the current tab, close tabs to the right, close other tabs, and close all tabs.
- **Keyboard Shortcuts — Toggle Active State**: shortcuts to toggle the sidebar, table of contents, and focus mode from the keyboard.
- **Keyboard Shortcuts grouping**: shortcuts in Settings modal and Homepage Shortcuts tab reordered into 6 functional groups — Navigation, Search, View & Themes, Structure, Tabs, and General.
- **CSV/TSV previews**: code fences switch between syntax-colored source and interactive data tables with delimiter detection, header inference, sorting, filtering, and chart controls.
- **XML fragment highlighting**: XML tags, attributes, values, comments, CDATA, entities, and namespaces are highlighted even without an XML declaration.
- **HTML document modes**: `.html` and `.htm` tabs can render isolated interactive HTML or converted Markdown, and open the original file in the system browser.
- **HTML document preview shortcut**: `Ctrl+Alt+H` toggles the active `.html` or `.htm` document between interactive preview and Markdown view.
- **Sidebar row action menus**: file and folder rows reveal a keyboard-accessible three-dot action button with viewport-aware menu placement.
- **Desktop location actions**: workspace tabs, document tabs, and sidebar files/folders expose native file-manager actions including a configurable active-document shortcut.
- **Responsive image rows**: same-paragraph Markdown images stay together in responsive rows while preserving authored widths.
- **Tips & Practices (9 languages)**: 9 multilingual Tips & Practices cards on the Welcome home page — English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian.
- **Terminal code fence highlighting**: syntax highlighting for `bash`, `sh`, `terminal`, `console`, `cmd`, `powershell`, and `zsh` fences.
- **VS Code external-file-change banner**: saving a Markdown file outside the VS Code panel now re-scans the sidebar and emits `currentFileChanged` so the renderer shows the refresh banner.
- **View Preferences tooltips**: tooltips appear above the hovered option with a directional arrow indicator, flipping below when the option is near the modal's top edge.
- **Reset Shortcuts confirmation**: a confirmation dialog is shown before Reset to Default Shortcuts restores any customized or disabled shortcuts.
- **Three-surface shortcut documentation**: synchronized shortcut tables across the Desktop app, VS Code extension, and Chromium extension.

### Changed
- **Keyboard Shortcut Search** is now available on all platforms (no longer desktop-only).
- **Settings experience**: View Preferences use compact grouped rows, vertically centered descriptions, dynamic shortcut text, corrected scroll ownership, and refreshed language/browser icons.
- **Document tab menus**: every action has a semantic icon, the containing-folder action shows its binding, and HTML tabs gain browser and view-mode actions.
- **Markdown presentation**: HTML comment sections use a pressed inset treatment, heading-level badges appear beside headings on hover/focus, and dragged tabs use dashed primary borders.
- **Settings Modal Width**: increased by 10% for improved readability.
- **Switch Toggle Contrast**: improved contrast of switch/toggle button circles in the Settings modal keyboard shortcuts section.
- **Left/right shortcut glyphs**: displayed as `←` and `→`; Settings close tooltip follows the `Close Settings - (Esc)` format in every supported language.
- **Scrollbars**: all scrollable areas (settings panel, modal body, search overlay, code blocks, and menus) use the `--bd-s` secondary border color for a consistent appearance.
- **Workspace Selection**: the workspace selection screen and its keyboard shortcut are available in the web and Chromium extension runtimes — excluded from the VS Code extension to avoid conflicts with VS Code's own workspace management.

### Fixed
- **Workspace scan cancellation**: canceled operations no longer leave an endless, non-interactive loading screen or reactivate stale tab state.
- **Missing workspace reopening**: choosing a replacement folder loads it into the unavailable tab and persists the new path correctly.
- **Frontmatter after comments**: YAML properties render when one or more leading HTML comments appear before the frontmatter block.
- **Settings layout and tooltips**: fixed overlapping controls, nested scrollbar displacement, tooltip clipping/stacking, and option-center alignment.
- **VS Code promise typing**: adapted VS Code `Thenable` results for extension and Electron compilation; removed an unused watcher import.
- **Localization coverage**: workspace-unavailable, preview, shell action, settings, shortcut, and discovery strings exist in every supported language.
- **Search Flush**: fixed incremental title-match results not being flushed to the UI promptly during workspace-wide search.
- **HTML comment/property ordering**: YAML properties remain rendered and responsive when a comment section appears first.
- **Vulnerable dependencies**: overrode DOMPurify to `3.4.12`, fast-uri to `3.1.4`, and fast-xml-parser to `5.10.1`.

### Removed
- **New Feature Guide**: removed the new feature guide overlay component, all associated translation keys, and supporting data files from the Welcome page.

---

## [1.5.9] — 2026-07-14

### Fixed
- **Tauri Update Checks**: Added dynamic Tauri app version metadata to ready and workspace-unavailable host messages so Settings can show the running version and compare update releases correctly.
- **Desktop Installer Selection**: Prevented Electron update checks from selecting Tauri installer assets while preserving legacy unprefixed Electron installer support.

### Maintenance
- **Tauri Dependency Audit**: Refreshed Tauri lockfile dependencies and documented that the remaining `glib` advisory applies only to Linux Tauri transitive dependencies.
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, Tauri, manifest, and lockfile metadata to `1.5.9`.

---

## [1.5.8] — 2026-07-14

### Added
- **Sidebar Scope Actions**: Added bulk selection toggle actions (Check all / Uncheck all) for sidebar scope focus editor.
- **HTML Comment Support**: Added parsing and rendering for markdown HTML comments, rendering them inside styled code blocks.
- **Markdown Properties Rendering**: Refactored frontmatter properties display to render inside an openable details disclosure grid.

### Changed
- **Tauri Global Cache**: Configured Tauri cargo build artifacts to use a global cache under `%LOCALAPPDATA%\\MarkdownExplorer\\tauri-cache`.
- **Rust Linker Selection**: Configured automatic fallback from MSVC to GNU target toolchain when `link.exe` is missing on Windows.
- **Scanner Limit Removal**: Removed the 1000 file scanning limit across Browser, Electron, and Tauri workspace scanners.
- **VS Code Launch Configuration**: Updated debug configurations for Tauri and Electron live reload, and set sorting order.

### Fixed
- **Tauri Cache Test**: Fixed directory path expectation in unit test to use space-free `MarkdownExplorer`.

---

## [1.5.7] — 2026-07-09

### Added
- **Vercel Theme**: Added a new Vercel-inspired styling theme with a sleek, clean, modern dark and light design, complete with custom design tokens, style picker integration, and translations.

### Fixed
- **Workspace Selection in Focus Mode**: Restored the Close Folder button in Focus view for Tauri, VS Code extension, and Electron desktop app, allowing users to exit the current workspace and open another.
- **Workspace Search**: Fixed a bug where workspace searches returned no results in Tauri by resolving items from the server-side flat list using `fsPath`.
- **Workspace List Actions Overlap**: Positioned the Rename and Delete buttons side-by-side instead of overlapping at the same absolute coordinates.

### Changed
- **Search Inputs Styling**: Refactored global Search Overlay and Find in File inputs to share consistent styling, adding rounded borders (`var(--r)`), padding, hover effects, and focus rings.
- **Horizontal Scrollbar Removal**: Hidden horizontal scrollbars on the main layout content container (`.content__scroll`) to prevent layout shifting on long code blocks or tables.
- **Electron Minimum Size**: Set the Electron app minimum window size to `720x480` to align window constraints with the Tauri version.

---

## [1.5.6] — 2026-07-08

### Added
- **Smooth App Opening**: Added animated loading transition when the app starts.
- **Search Load More**: Multi-tab search now shows a "load more" control for paginated results.
- **Compact TOC Sticky**: Compact table-of-contents is now sticky inside the content area.

### Fixed
- **Workspace Tab Sizing**: Workspace tabs now size to their label width with an 80-ch ellipsis cap.

### Tests & Coverage
- **Panel Gap Tests**: Added VS Code panel gap and extension tests.
- **Component Coverage**: Render and interaction tests for all major UI components, hook and context coverage, and DOM handler tests.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, manifest, and lockfile metadata to `1.5.6`.

---

## [1.5.5] — 2026-06-23

### Added
- **New Document Formats Support**: Added support for converting and previewing `.doc`, `.xls`, and `.xlm` file formats to Markdown preview.

### Maintenance
- **Dependency Upgrades**: Upgraded `@the-long-ride/markdown-them` package to version `1.3.1`.
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, manifest, and lockfile metadata to `1.5.5`.

---

## [1.5.4] — 2026-06-21

### Changed
- **Workspace Search Layout**: Moved workspace search into the sidebar so the app variants follow a more VS Code-like navigation flow.
- **Desktop Release Packaging**: Windows desktop releases now prioritize the NSIS installer, and desktop artifact filenames no longer include the version number.
- **Desktop UI Controls**: Tightened sidebar tab sizing, raised the sidebar minimum width to 245 px, improved tab-view header control spacing so primary actions stay grouped more consistently, and renamed the light/dark toggle action to context-aware next-mode labels.

### Fixed
- **Windows Installer Updates**: The desktop updater now handles NSIS installer packages correctly during in-app update flows.
- **TOC & Focus Controls**: Removed redundant in-body TOC toggle controls and kept focus-mode access inside the settings action menu across header variants.
- **Search Readability**: Improved contrast and icon visibility for sidebar search and all-tabs search results across themes, especially in darker and pet-theme surfaces.
- **Workspace Renaming Guidance**: Added desktop workspace rename affordances and aligned recent-workspace interactions with tab-based rename behavior.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, manifest, and lockfile metadata to `1.5.4`.

---

## [1.5.1] — 2026-06-16

### Added Features & Enhancements
- **Chromium Extension Variant**: Introduced a new variant of Markdown Explorer as a standalone Chromium Browser Extension, allowing users to run it directly inside Chrome, Brave, Edge, and other Chromium browsers with local file access.
- **Enhanced Chart View**: Merged the separate chart view switcher buttons into a single custom dropdown selection menu that matches the pet theme dropdown design and fits compactly next to the Wrap button.
- **macOS Install Guide Link**: Added an installation and Gatekeeper bypass guide button for the macOS desktop app, available on both the landing website and inside the desktop app interface (on the welcome and workspace selection screens), using the GitHub content guidelines link.
- **Parallel Release Pipeline**: Configured a new parallel build process in the GitHub Actions workflow (`release.yml`) using Node 24 to package and release the Chromium extension.
- **K-Ink Pet Theme Polish**: Restructured pet theme CSS styles to restrict dark-mode overrides in the K-Ink theme, restoring proper high-contrast text rendering on light backgrounds when using light or auto-light modes.

### Changed & Renamed
- **Chrome to Chromium Transition**: Renamed all code, comment, build script, and documentation references from "Chrome Extension" to "Chromium Extension" for platform accuracy.

### Fixed
- **Chromium Extension Media Loading**: Fixed local and secure external media loading/rendering in the Chromium extension and normalized Windows backslashes in relative image/video paths.
- **Chromium Guide Translation Fallbacks**: Added fallback English labels `(Developer mode)` and `(Load unpacked)` to all non-English Chromium extension installation guide translations and resolved a Cyrillic typo in the Korean translation.
- **Settings Translation**: Localized the Document Conversion preview setting title and description in the Settings modal for all supported languages.

---

## [1.5.0] — 2026-06-11

### Added Features & Enhancements
- **Document Conversion Preview**: Added optional Markdown previews for DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files using `@the-long-ride/markdown-them`, with loading feedback during scan and conversion work.
- **Sidebar Cursor Mode**: Added `Alt+S` sidebar keyboard navigation with highlighted focus, arrow-key movement, Enter-to-open or expand folders, Escape-to-exit, and click-outside dismissal.
- **Tab Context Menus**: Added right-click actions for content tabs: close current tab, close tabs to the right, close other tabs, and close all tabs.

### Changed
- **Sidebar Focus Treatment**: Dimmed the rest of the app and strengthened the sidebar shadow while Sidebar Cursor Mode is active, with eased transitions.
- **Converted Preview Messaging**: Localized converted-document warning text so users understand conversion preview quality may differ from the original file.
- **Welcome Guidance**: Updated the welcome page with guidance for recent features from the 1.4.5 series through this release.

### Maintenance
- **Feature Screenshots**: Refreshed README and website images for document conversion, Sidebar Cursor Mode, and Theme Remix.
- **Release Version Bump**: Updated VS Code, UI, workspace metadata, and lockfile metadata to `1.5.0`.

---

## [1.4.8] — 2026-06-10

### Added Features & Enhancements
- **Theme Remix**: Added a settings workflow for creating, editing, duplicating, deleting, selecting, importing, and exporting custom themes built from app layouts, pet themes, custom colors, density, spacing, and background images.
- **Settings Import & Export**: Added JSON import/export for user settings, custom themes, and desktop workspace history, with schema metadata for future compatibility.
- **Workspace Not Found Recovery**: Added validation for desktop workspace paths so missing or locked workspaces show a not-found page with recovery actions instead of loading forever.

### Changed
- **K-Ink Readability Polish**: Darkened K-Ink panel surfaces and brightened sidebar, table of contents, search, and content text for better contrast.
- **Theme Remix Refinements**: Updated remix controls with custom dropdowns, compact icon-only item actions, range values, image-size warnings, constrained modal height, and safer list scrolling.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, website metadata, and lockfile metadata to `1.4.8`.

---

## [1.4.7] — 2026-06-04

### Added Features & Enhancements
- **Welcome Experience Refresh**: Redesigned the welcome screen with an interactive background, tabbed content, richer workspace actions, and quick guidance for desktop and VS Code users.
- **Workspace Switch Confirmation**: Added a dedicated desktop confirmation modal when dropping or switching to another workspace, keeping multi-tab workflows clearer.
- **Desktop Download Messaging**: Updated website download copy to explain that the desktop app supports tabs, multiple workspaces, more keyboard shortcuts, and additional features beyond the VS Code extension.

### Changed
- **Privacy & Terms Onboarding**: Simplified the first-run legal prompt to a concise agreement with external Privacy Policy and Terms of Service links.
- **Warm Accent Theme Polish**: Updated accent colors and modal spacing for the refreshed UI direction.

### Fixed
- **Markdown Copy Formatting**: Copy actions now use the original Markdown source when available so copied content keeps the correct Markdown formatting.
- **Recent Workspace Removal in Tabs**: Removing an item from recent workspaces in Tab view no longer reopens the previous workspace in a new tab.
- **Legal Prompt Layout**: Kept the review sentence on one line when space allows and aligned the checkbox with the agreement label.

### Maintenance
- **Unused Icon Cleanup**: Removed obsolete UI SVG icons from `ui/assets/icons`.
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, website metadata, and lockfile metadata to `1.4.7`.

---

## [1.4.6] — 2026-06-03

### Added Features & Enhancements
- **Code Selection Gutter Highlighting**: Selecting code across multiple lines now highlights every affected line number in the gutter.
- **Table Text Wrapping Toggle**: Data tables now include a per-table Wrap/Unwrap control in Table view, defaulting to unwrapped horizontal scanning and hiding during chart views.
- **String Interpolation Highlighting**: Code highlighting now detects common interpolation forms and gives interpolation expressions contrast from the surrounding string.

### Changed
- **Compact Markdown Chrome**: Reduced code block, table, section header, and divider spacing for a tighter reading layout.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, and lockfile metadata to `1.4.6`.

---

## [1.4.5] — 2026-06-03

### Added Features & Enhancements
- **Internal Workspace Links**: Markdown links starting with `/`, `./`, or `../` now navigate to referenced workspace files and stay in back/forward history.
- **Navigation Test Fixture**: Added `test/test-navigation.md` to exercise same-folder, workspace-root, and parent-directory Markdown links.
- **Workspace Loading Feedback**: Opening workspaces and refreshing now show the existing loading screen while host scan and render work is in progress.
- **Desktop Tab Scrollbar**: Added a draggable custom accent-colored tab scrollbar positioned below the desktop tab strip.

### Changed
- **README Homepage Link**: Added the Markdown Explorer homepage link to the README.
- **VS Code Marketplace Homepage**: The VS Code extension manifest now points to the GitHub Pages homepage.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, and lockfile metadata to `1.4.5`.

---

## [1.4.4] — 2026-06-02

### Added Features & Enhancements
- **9-Language UI**: Added a built-in language switcher (globe icon in Settings header) supporting English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian. All UI surfaces — Settings modal, Topbar, Sidebar, Table of Contents, Welcome page, floating toolbar, workspace controls and modals — now render in the selected language without a restart.
- **Sidebar & TOC Translations**: Sidebar heading, file-filter placeholder, TOC title, "Return to top" button, and compact-TOC label are now fully localized.
- **Welcome Page Translations**: Hero section, features list, keyboard shortcuts table, privacy pledge, and report-issue section are all translated through `welcomeTranslations.ts`.
- **Close-Tab Tooltip**: Tab close button in the desktop tab bar now shows a native browser `title` tooltip ("Close tab") to avoid layout side-effects from absolute-positioned custom tooltips inside the scrollable tab strip.

### Changed
- **Settings Modal Width**: Increased maximum width to 912 px (×1.2 from previous 760 px) for better readability at normal zoom levels.
- **Settings Text Selection**: Text inside `.settings-card` is now selectable (`user-select: text`).
- **Keyboard Shortcut Order in Settings**: Reordered the shortcut list to *Find in file → Search workspace (current tab) → Search all tabs* for a more logical flow.
- **Default Toggle-Theme Shortcut (Desktop)**: Changed the desktop app default from `Ctrl+Shift+L` to `Ctrl+L`; VS Code extension default remains `Ctrl+Shift+L`.
- **Floating Tab Toolbar Opacity**: Toolbar auto-reduces to 20% opacity 3 seconds after losing focus; hover or focus restores full opacity.
- **Responsive Settings Layout**: Added breakpoints so the settings modal stacks gracefully at narrow viewport widths.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, and VS Code package metadata to `1.4.4`.

---

## [1.4.2] — 2026-06-01

### Added Features & Enhancements
- **In-App Update Checks**: Desktop and VS Code variants now check the latest GitHub Release on startup and compare it against the running app or extension version.
- **Update Notification UI**: Settings buttons now show an update indicator when a newer release is available, and Settings includes a `Download new version` action.
- **Platform-Aware Update Links**: Desktop downloads now resolve to the matching release asset for Windows, macOS, or Linux, while the VS Code variant opens the Marketplace listing.
- **Release Changelog Links**: Update prompts and website release notes now link directly to the GitHub changelog.
- **Release Download Counts**: The website reads GitHub Release asset download counts from the GitHub API and displays them beside desktop download buttons.

### Changed
- **Mermaid Diagram Fit**: Rendered Mermaid SVGs now scale within the available max-height instead of showing an internal overflow scrollbar.
- **Desktop Main Process Structure**: Split desktop window, tray, IPC, recents, search index, markdown rendering, and YouTube header logic into focused helper modules.
- **UI Module Structure**: Split large desktop, workspace, state, utility, token, and global style surfaces into smaller focused files.

### Fixed Issues
- **Tall Mermaid Diagrams**: Tall flowcharts and diagrams now remain contained in the document panel without adding a nested diagram scrollbar.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, lockfile, and website metadata to `1.4.2`.

---

## [1.4.1] — 2026-06-01

### Added Features & Enhancements
- **Copy Actions**: Added copy buttons for whole files and heading sections, with a small success effect after copying.
- **Workspace Drop Handling**: Added drag-and-drop support for markdown files and folders from the workspace selection screen, Focus view, and Tab view, including tab-aware folder opening behavior.
- **Markdown Math & Diagram Rendering**: Added stronger KaTeX handling for LaTeX blocks and constrained rendered Mermaid SVGs to a readable viewport height.
- **Desktop Shortcut Customization**: Added customizable desktop search shortcuts and changed desktop defaults to `Ctrl+F` for current-workspace search and `Ctrl+Shift+F` for all-tab search.
- **Find In Current File**: Added a dedicated in-file find panel with desktop `F` and VS Code `K` defaults.
- **Content Search Jumps**: Search results now carry match positions so clicking a result jumps to the exact selected occurrence, not just the first match in a file.
- **Markdown Video Support**: Added rendering for local video files and supported streaming links, including YouTube embeds with fallback links.
- **Static Website**: Added a GitHub Pages website with SEO metadata, release download buttons, and a refreshed screenshot gallery.

### Changed
- **Markdown Rendering Polish**: Improved frontmatter display, multiline table cell layout, theme-aware inline code styling, copy-friendly inline code wrapping, and richer math test coverage.
- **Code Block Usability**: Tightened line-number columns, aligned line numbers with code rows, and highlighted focused or selected line ranges in the gutter.
- **Tab View Controls**: Refined Tab view toolbar layout, compact control behavior, mouse-wheel tab closing, and current-tab versus all-tab search behavior.
- **Background Pets**: Enlarged background pet artwork and added subtle random movement.
- **Sidebar Labels**: Defaulted sidebar labels to off.
- **Search UX**: Search result excerpts now bold the full matched query and show compact context around it.
- **Settings Layout**: Settings switch to a sequential layout at high zoom or small viewports.
- **Website And README**: Refreshed product copy, shortcuts documentation, reporting guidelines, and demo screenshots.

### Fixed Issues
- **Scroll-To-Top Button**: Restored the button in both variants and fixed its position when zoomed in heavily.
- **Table of Contents Active Marker**: Adjusted active item marker height so it follows text height in the default theme.
- **Sidebar Resize**: Restored sidebar width adjustment, including first-open restored workspace states.
- **Markdown Tables**: Improved rendering for rows with multiline cells and long inline code commands.
- **Large Table Filtering**: Sorting and filtering now operate on all real rows, preserve collapsed state, and support multi-choice column filters.
- **Search Panel Stacking**: Raised search panel layering so it stays above sticky page UI.
- **Floating Toolbar Bounds**: Prevented the Tab view floating toolbar from being dragged off-screen.
- **Workspace Selection Overflow**: Removed the unexpected horizontal scrollbar on the workspace selection page.
- **Find Highlight Contrast**: Active in-file search highlights now use theme background text color for better readability.

### Removed
- **PDF Export**: Removed the PDF conversion feature and related packages/code after deciding the app should stay focused on Markdown exploration.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, and VS Code package metadata to `1.4.1`.

---

## [1.4.0] — 2026-05-30

### Added Features & Enhancements
- **Desktop Workspace Tabs**: Added the optional desktop tab view for opening multiple workspaces, switching between them, renaming tabs, reopening saved tabs, and keeping each tab's current file state.
- **Cross-Tab Search**: Added desktop cross-workspace search so Tab view can search files from every open workspace with `Ctrl+Shift+K`.
- **Cute Anime Pet Artwork**: Replaced the pet theme background treatment with transparent PNG anime pet artwork and wired the pet picker to preview those images.
- **K-Ink Theme**: Added a dedicated `K-Ink (app author's dog)` pet theme with the supplied dog artwork, a custom paw icon, and a softer lower-contrast palette.

### Changed
- **Black Shiba Restored**: Renamed the previous K-Ink-labelled Shiba theme back to **Black Shiba** so K-Ink can live as its own theme.
- **Tab View Controls**: Restored top-right Tab view controls for theme toggle, settings, sidebar toggle, and window actions.
- **Wider Path Display**: Increased breadcrumb and tab label width budgets so file paths use the available toolbar space before truncating.
- **Media Modal Zoom**: Raised maximum image zoom to **2000%** for high-resolution inspection.

### Maintenance
- **Electron-Only Desktop Source**: Confirmed the source and dependency tree no longer include Tauri references.
- **VS Code Bundle Size Reduction**: Reduced the VSIX footprint by resizing decorative pet PNGs and loading selected Highlight.js and Chart.js modules instead of their full bundles.
- **Release Version Bump**: Updated workspace, UI, desktop, and VS Code package metadata to `1.4.0`.

---

## [1.3.6] — 2026-05-27

### Added Features & Enhancements
- **ZenUML Diagram Support**: Installed `@mermaid-js/mermaid-zenuml` and registered it via `mermaid.registerExternalDiagrams([zenuml])` in [main.tsx](ui/src/main.tsx), enabling offline rendering of ZenUML sequence diagrams within code blocks.
- **Expanded Mermaid Keyword List**: Added `block-beta`, `packet`, `architecture-beta`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, and `C4Deployment` to the auto-detection keyword list in [renderer.ts](vscode/src/markdown/renderer.ts) so unlabeled code blocks starting with any of these keywords are rendered as Mermaid diagrams automatically.

### Fixed Issues
- **General Text Selection**: Enabled text selection in the webview (`user-select: text`) on `html` and `body` in [global.css](ui/src/styles/global.css) to override VS Code's default `user-select: none` webview lock. Interactive UI elements (sidebar, buttons, resize handles, tree nodes, topbar) retain `user-select: none` for clean drag and click behavior.
- **Heading Text Selection**: Collapsible section titles (`.mdn-section-title`) now explicitly set `user-select: text` so heading text can be selected and copied even though the parent section header uses `user-select: none` for click-to-collapse.
- **Architecture Diagram Syntax**: Corrected `architecture-beta` edge direction syntax in [test-diagrams.md](test/test-diagrams.md) — directions must use single uppercase letters (`L`, `R`, `T`, `B`), not full words.
- **C4 Diagram Keyword**: Replaced invalid `c4Diagram` keyword with correct Mermaid C4 specifiers (`C4Context`, `C4Container`, etc.) in both [renderer.ts](vscode/src/markdown/renderer.ts) and [test-diagrams.md](test/test-diagrams.md).
- **Requirement Diagram Properties**: Fixed invalid `severity` property in test file; replaced with valid `risk: high` and `verifymethod: test` properties per Mermaid spec.
- **Ordered List Numbering**: Fixed ordered list parser in [parser.ts](vscode/src/markdown/parser.ts) to correctly group consecutive items, support nested content, and honour custom `start` attributes.

---

## [1.3.5] — 2026-05-27

### Added Features & Enhancements
- **Mermaid Auto-rendering**: Plain text and un-tagged code blocks starting with any valid Mermaid keyword (such as `flowchart`, `sequenceDiagram`, etc.) are now automatically detected and rendered as visual Mermaid diagrams.
- **Collapsible Code Blocks**: Code blocks exceeding 20 lines are rendered in a collapsed state (`max-height: 380px` with a bottom gradient fade) and feature a "Show More" / "Show Less" toggle button.
- **Inline Code Styling**: Backtick elements (`.mdn-inline-code`) are enhanced with a warm Claude-like orange color (`#ff7e40` in dark theme, `#d95420` in light/auto theme), increased font size (`0.88em`), and larger padding (`2px 6px`).
- **5-Tier Breadcrumb Folding**: Implemented a smart progressive folding algorithm for active file path display (`root / sub-root / ... / parent / file.md`), folding down to `... / file...me.md` for long names, targeting a 45-character budget.
- **Viewport-Adaptive Breadcrumb Tooltip**: Sized the tooltip using `max-width: max(280px, calc(100vw - 340px))` with left-alignment, slash-wrapping, and omitted it on the Welcome Page.

### Fixed Issues
- **Code Block Copy Button**: Resolved copy code functionality by registering global window handlers to use `PlatformBridge.copyToClipboard` with `navigator.clipboard` fallback.

---

## [1.3.4] — 2026-05-26

### Fixed Issues
- **Electron Build Icon**: Corrected builder icon configurations to point to the existing `logo-512.png` asset.
- **Breadcrumb Tooltip**: Added a tooltip showing the full absolute path when hovering over the current file path breadcrumb.

---

## [1.3.2] — 2026-05-26

### Added Features & Enhancements

#### 🐧 Linux Desktop Support
- **Linux Packages**: Configured build packaging for Linux desktop clients to output both `.deb` installers and `.AppImage` packages.
- **GitHub Actions Release Integration**: Configured `release.yml` with a build matrix strategy (`windows-latest`, `ubuntu-latest`) to build and upload Windows and Linux desktop binaries automatically to GitHub Releases.
- **Debian Control Metadata**: Added necessary packaging fields (homepage, description, author email) in `desktop/package.json` to successfully build Debian-compliant `.deb` installers.
- **VS Code Linux Debugging**: Verified and ensured that the local `Debug Desktop App` launcher target resolves and executes natively under Linux environments.

---

## [1.3.1] — 2026-05-26

### Added Features & Enhancements

#### 🖥️ Standalone Desktop App Interactivity
- **Modals Overlay Bypass**: Elevated the z-index of window controls and the theme toggle bar to `200000` (above the backdrop overlays) across `WorkspaceSelection.tsx`, `App.tsx`, and `.topbar` in `global.css`. Users can now drag the window, minimize, maximize, close, or toggle the theme even when a modal is open.
- **Relocated Media Modal Close**: Shifted the fullscreen media viewer's close button (`.mdn-modal-close`) from `top: 24px` to `top: calc(var(--topbar-h) + 12px)` to prevent overlap and clashing with window control buttons in desktop mode.
- **Max 5 Items List Limit**: Constrained the recent workspaces scrollable list to show at most 5 items at the same time (using `max-height: 352px` and `overflow-y: auto`).
- **Fixed Horizontal Scrollbar**: Added `overflow-x: hidden` to the scrollable workspaces list container to fix horizontal scrollbars caused by scrollbar widths or direction text.

#### 🔗 Repository Renaming Sync
- **Repository URL Migration**: Updated all references to the repository from `vscode-extension-markdown-explorer` to the new name `markdown-explorer` across package files, welcome screens, and READMEs.

---

## [1.3.0] — 2026-05-25

### Added Features & Enhancements

#### 🖥️ Standalone Electron Desktop Target (`/desktop`)
- **Native Cross-Platform Wrapper**: Wrapped the React application in a native Electron wrapper featuring tray icons, system notifications, and automated updates.
- **Frameless UI Controls**: Designed custom window management Minimize, Maximize/Restore, and Close controls in the Topbar, styled with responsive borders and absolute layout headers to allow seamless windows dragging.
- **Premium Workspace Selector Page**: Designed a centered frameless start screen displaying a native directory folder picker and a recent workspace folder list with click triggers and direct toggle collapses.

#### 🔤 Offline Custom Font Packs & Local Separation
- **Offline Typography Integration**: Embedded local font faces for **Be Vietnam Pro** (UI text) and **Cascadia Code** (code styling), keeping only the required TTF files to drastically optimize built asset footprints.
- **Dynamic Platform Font Routing**: Placed custom fonts inside `body.is-electron` while defaulting `:root` to standard VS Code system families. VS Code extension webviews automatically respect and leverage user UI settings without forcing custom packages, while Desktop builds cleanly launch custom fonts.
- **Redundant Resource Exclusion**: Added strict ignore rules inside `.vscodeignore` and `desktop/package.json` to prevent packaging source fonts. **Slashed the VS Code extension VSIX size in half down to 173.34 KB**!

#### 🔗 Path Breadcrumb Truncation & Folding (`...`)
- **Relative Path Collapsing**: Automatically folds long paths into `...` when segment counts exceed 3 (`root / ... / parent / file.md`), saving draggable frameless window space.
- **Important Ellipsis Overrides**: Customized `span.topbar__breadcrumb-part` using `!important` declarations inside `global.css` to reliably enforce ellipsis truncation without container box clips.
- **Hover Tooltip**: Displays the complete, unmodified relative path inside a beautiful aligned `.tooltip-text` bubble on hover.

#### 📊 High-Performance Sticky Table Headers
- **Layout Overflow Isolation**: Replaced `.mdn-table-scroll` horizontal scrolling with vertical bounds isolation (`overflow-y: clip`), resolving long-standing sticky position bugs under Chrome and Electron.
- **Nesting Boundary Propagation**: Changed collapsible accordion container bounds from `overflow: hidden` to `overflow: clip` so sticky table headers stick perfectly to the main page scroll port while retaining parent rounded border shapes.

#### ⚙️ Shortcut Customizer Spacing & Tooltips
- **Improved Shortcuts Readability**: Joined recorded shortcuts with spaces (`Ctrl + Shift + Key`) and set `letter-spacing: 1px` inside Settings customizable input boxes.
- **Close Modal Tooltips**: Added a custom `Close Settings [Esc]` tooltip popup on the settings overlay Close (`×`) icon.

#### 🤖 GitHub Actions Parallelized Releases
- **Multi-Runner Parallel Builds**: Refactored the GHA workflow to package the `.vsix` extension on Ubuntu and the `.exe` Electron application on Windows concurrently, publishing both final assets inside a single automated tag-release.

---

## [1.2.0] — 2026-05-25

### Added Features & Enhancements

#### ⚛️ Interactive MDX Support

- **MDX Extension Support**: Added native rendering for `.mdx` files, automatically parsing React-like JSX syntax, components, and event handlers.
- **Import/Export Filtering**: Cleans up and strips MDX import and export statements during rendering so they do not clutter the document.
- **Stateful Custom Web Components**: Integrated three interactive web components out of the box: `<InteractiveCounter />` for custom count increments, `<ConfettiButton />` for custom celebration particle bursts, and slot-based `<InteractiveTabs />` for nested panels.

#### 🎛️ Sandboxed HTML Live Previews

- **Isolated iframe Executions**: HTML code blocks now render in a secure, isolated `iframe` environment that safely executes Javascript and custom styling without CSS leaks to the main viewport.
- **Code/Preview Toggle**: Effortlessly toggle between the live visual rendering and raw highlighted source code with a single header button.
- **Smart Height Scaling**: Automatically listens to the document size inside the iframe and dynamically scales its height to prevent unnecessary scrollbars.

#### 🔢 Code Block Line Numbers

- **Gutter Line Numbers**: Standardized code formatting across all programming language blocks by introducing clean, vertical line numbering.

#### 🎨 Multilingual Syntax Highlighting

- **14 New Languages**: Added robust syntax highlighting rules for C, C++, Java, C#, PHP, Ruby, Swift, Kotlin, R, Scala, Elixir, Dart, Hack, and Perl.
- **Embedded Style/Script Parsing**: Highlighted custom CSS style blocks and script logic nested within HTML code blocks.

#### ⚙️ Viewer Settings Panel

- **Persistent Configuration Overlay**: Click the new gear icon (`⚙️`) to open a configuration modal. Easily customize whether to show H1 title vs filename in the file tree, and choose whether HTML blocks default to preview or code view.

#### 🔄 Live Editor Buffers & Topbar Refresh

- **Live Buffer Reading**: WorkspaceScanner dynamically queries active `textDocuments` in memory, allowing Markdown Explorer to render unsaved edits instantly when navigating files.
- **Topbar Refresh Action**: Added a circular sync button on the right of the sidebar toggle button, styled to match the theme color via `fill="currentColor"` and using the new `refresh-icon.svg` asset, to manually trigger a workspace scan and file content reload.

---

## [1.1.1] — 2026-05-24

### Added Features & Enhancements

#### 🚀 Immediate Activity Bar Launch

- **Instant Opening**: Clicking the Markdown Explorer icon in the activity bar now immediately launches the main webview panel in the editor area, automatically skipping and closing the primary sidebar view.

#### 🎛️ Consolidated Title Actions

- **Single Toggle Button**: Consolidated the editor toolbar buttons by removing the duplicate preview button, displaying a single Markdown Explorer toggle icon in the editor title bar.

#### ⌨️ Shortcut Documentation

- **Launch Keys Info**: Added clear keyboard shortcut documentation (`Ctrl+Shift+M` or `Cmd+Shift+M` on macOS) to both the Welcome page and the README.md to help users trigger the explorer easily.

#### 🖼️ Raw HTML Image & Layout Support

- **Safe HTML Rendering**: Enabled parsing of standard formatting, layout, and image tags (`<img>`, `<p>`, `<div>`, etc.), allowing raw HTML images to render styled and open in the fullscreen zoom modal perfectly.

#### 🔗 Robust Document Link Navigation

- **Space & Path Resolving**: Decodes URL encoded relative paths (such as `%20` for spaces) and dynamically resolves base paths and checks file existence on disk via `fs.existsSync` to prevent loading lockups or "File not found" pages.

#### 📜 MIT License Link

- **Welcome Page License**: Included a direct link to the repository's MIT License on GitHub in the Welcome Page subtitle.

---

## [1.1.0] — 2026-05-23

### Added Features & Enhancements

#### 🏠 Welcome Page & Home Button

- **Offline-First Welcome Page**: Introduced a Welcome page displaying project repository links, author details, usage guidelines, and a strict privacy pledge (100% offline use, zero tracking, and no external tracking libraries).
- **Topbar Home Button**: Integrated a theme-matching Home button (`| ⌂`) using the `homepage-icon.svg` asset. Clicking it navigates back to the Welcome page.
- **Edit Button Disablement**: Automatically disables the topbar "Edit" button when on the Welcome page.

#### 📁 Left Activity Bar Sidebar Icon

- **Sidebar Integration**: Contributed a custom view container to the left activity bar using the `markdown-manifier-light.svg` icon. Selecting it immediately opens or reveals the Markdown Explorer.

#### ⌨️ Toggle Keybinding & Documentation

- **Keybinding Documentation**: Explicitly documented the `Ctrl+Alt+V` (or `Cmd+Alt+V` on macOS) keybinding to toggle the Markdown Explorer preview.
- **Privacy Section**: Added a dedicated privacy, security, and offline-first section to the README.

### Fixed Issues

- **Packaging Fix**: Resolved an issue where compiled JavaScript files in the `out/` folder were excluded from the VSIX due to `.gitignore` rules. Added `!out/**` to `.vscodeignore` to guarantee all compiled code is packaged.

---

## [1.0.0] — 2026-05-23

This is the initial release of the Markdown Explorer extension.

### Implemented Features

#### 📁 Navigation & Workspace

- **Workspace Directory Tree**: Automated scanning of active workspace folders and building a sidebar navigation menu for files.
- **Fast Search**: Press `Ctrl+K` to open a global search popover to quickly search and switch between markdown notes.
- **Breadcrumb Tooltip**: breadcrumbs in the header dynamically display the file's workspace folder path on hover.

#### 📝 Collapsible Sections & Table of Contents (TOC)

- **Collapsible Header Sections**: H1 and H2 markdown headers automatically group consecutive tokens into collapsible accordion elements.
- **Interactive TOC Panel**: Generates a smooth-scroll "On This Page" panel to jump directly to document sections.

#### 📊 Smart Tables & Live Charts

- **Sticky Table Headers**: Freezes the row headers to the top of the scrolling viewport (similar to Excel freeze panes).
- **Funnel Category Filter Dropdowns**: Scans table columns for recurring categorical values and creates a funnel icon to filter cell contents.
- **Live Text Queries**: Standard table search bar for filtering rows in real-time.
- **Dynamic Table-to-Chart Conversion**: Autodetects numeric columns and renders **Bar**, **Line**, or **Pie** charts using Chart.js.

#### 🎨 Premium Styles & Light Theme Legibility

- **High Contrast Syntax Highlighting**: Specially tuned contrast for light-theme systems, making comments, punctuation, variables, and parameters readable.
- **TypeScript Member Separated Colors**: Colors property keys (purple) and type annotations (orange) differently to separate types from properties.
- **Nullable Properties Highlights**: Custom post-processor highlights TypeScript nullable/optional keys (`key?: type`), including reserved keywords (e.g. `default?:`).
- **Extension Logo**: Implemented custom rounded-square purple logo (`logo-128.png` in topbar and `logo-500.png` in marketplace) and resolved SVG theme-colors.

#### 🖼️ Image and Diagram Modals

- **Zoomable Media Viewer**: Backdrop-blurred fullscreen overlay to view screenshots, images, and SVGs.
- **Drag-to-Pan & Scale**: Mouse wheel zooming and click-and-drag panning.

#### 📦 Optimized Package Size

- **vscodeignore Configuration**: Configured strict ignore rules, compressing the extension binaries down to a lightweight **84.7 KB**.
