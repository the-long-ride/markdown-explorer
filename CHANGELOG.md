# Changelog

All notable changes to the **Markdown Explorer** extension will be documented in this file.

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
- **Tauri Desktop Variant**: Introduced a new Tauri-based desktop app (`tauri/`) with a full Rust backend — dispatcher, workspace scanner/watcher, search index, update manager, document converter, YouTube renderer, and performance profiling module.
- **Smooth App Opening**: Added animated loading transition when the app starts to improve perceived performance.
- **Search Load More**: Multi-tab search now shows a "load more" control for paginated results instead of flooding the view.
- **Compact TOC Sticky**: Compact table-of-contents is now sticky inside the content area and gated behind `!tocCollapsed` state.

### Changed
- **Website Demo**: Rebuilt demo landing as a React app with virtual and file modes; replaced bridge page with a nav dropdown (Examples / Open a file). CI generates the demo file manifest from `tests/*.md` on deploy.
- **Workspace State Detection**: Improved file-state change detection in the workspace watcher and refresh logic; extended `AppStateContext` to track pending-refresh signals.
- **Electron Source Layout**: Renamed `desktop/` to `electron/` and reorganised sources by mission area (IPC, lifecycle, search, render, workspace).
- **Package Manager**: Migrated root workspace and all sub-packages to `pnpm` with isolated + shamefully-hoisted node_modules.

### Fixed
- **Workspace Tab Sizing**: Workspace tabs now size to their label width with an 80-ch ellipsis cap.
- **Scroll-to-Top Button**: Shrunk and nudged the scroll-to-top button to reduce visual footprint.

### Tests & Coverage
- **Vitest Infrastructure**: Bootstrapped full Vitest coverage suite with per-package gates (lines / functions / statements).
- **Component Tests**: Added render and interaction tests for all major UI components (Topbar, DesktopTabBar, SidebarSearch, WorkspaceSelection, modals).
- **Hook & Context Tests**: Coverage for `useDesktopTabs`, `useUpdateCheck`, `useFileDropOpen`, `useIsDark`, `usePlatform`, `AppStateContext`, navigation reducer, and DOM handlers.
- **Electron Tests**: 755+ tests covering native shell, IPC, lifecycle, diagnostics, filesystem, renderer, search, and workspace watcher.
- **Chromium Tests**: Tests for file-access, scanner, search-index, chrome-host commands, and bootstrap.
- **Contract Tests**: Host-message parity, package-config contracts, Tauri dispatcher/host-message parity, and workflow-config assertions.
- **CI**: OS/Node matrix (Node ≥ 22), parallel test jobs, fake timers for performance, release gate on passing tests.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, manifest, and lockfile metadata to `1.5.6`.

---

## [1.5.5] — 2026-06-23

### Added
- **New Document Formats Support**: Added support for converting and previewing `.doc`, `.xls`, and `.xlm` file formats to Markdown preview.
- **Settings Dropdown Edit Button**: Restored the `Edit` button to the settings action menu in tab views, matching the Focus view layout.

### Maintenance
- **Dependency Upgrades**: Upgraded `@the-long-ride/markdown-them` package to version `1.3.1`.
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, manifest, and lockfile metadata to `1.5.5`.

---

## [1.5.4] — 2026-06-21

### Changed
- **Windows Desktop Release**: Windows builds now ship with an NSIS installer as the primary desktop package, while portable and zip builds remain available as secondary artifacts. Desktop artifact filenames no longer include the version number, so Windows file properties remain the source of version metadata.
- **Workspace Search Layout**: Moved workspace search into the sidebar so the desktop and browser app follow a more VS Code-like navigation flow.
- **Desktop UI Controls**: Tightened sidebar tab sizing, raised the sidebar minimum width to 245 px, improved tab-view header control spacing so primary actions stay grouped more consistently, and renamed the light/dark toggle action to context-aware next-mode labels.

### Fixed
- **Windows Installer Updates**: The in-app Windows updater now detects NSIS installer packages and runs them as installers instead of treating every `.exe` like a portable binary swap, which keeps installed desktop updates working correctly.
- **TOC & Focus Controls**: Removed redundant in-body TOC toggle controls and kept focus-mode access inside the settings action menu across header variants.
- **Search Readability**: Improved contrast and icon visibility for sidebar search and all-tabs search results across themes, especially in darker and pet-theme surfaces.
- **Workspace Renaming Guidance**: Added desktop workspace rename affordances and aligned recent-workspace interactions with tab-based rename behavior.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, Chromium extension, manifest, and lockfile metadata to `1.5.4`.

---

## [1.5.3] — 2026-06-18

### Added
- **Windows Portable Self-Update Flow**: Desktop app on Windows can now download and apply updates in-place without requiring a separate installer. Settings shows a progress card with download percentage, scheduled-on-exit, and apply-now actions. An external helper process swaps the running `.exe` on quit and writes a result code so the next launch can report success or failure. All update strings are fully localized across the 9 supported UI languages.
- **Workspace File Watcher**: Desktop now watches the active workspace directory for file-system changes (create, rename, delete) and automatically refreshes the sidebar and scope focus state with a 120 ms debounce, so the file tree stays in sync without a manual refresh.
- **Scope Focus Live Sync**: Scope focus selection is now reconciled automatically when the workspace file list changes. New files that belong to a previously selected folder are included automatically; removed files are dropped. Folder-level selections track all descendant files so adding files inside a focused folder never breaks the scope.
- **Native TXT File Support**: Added native support for `.txt` files directly in Markdown Explorer, allowing plain-text content to be viewed without enabling the document conversion feature.

### Changed
- **Deferred Desktop Startup**: Heavy startup work (workspace scan, search index build) is now deferred until after the window is fully visible, reducing perceived cold-start time. A `MDN_PERF=1` environment variable enables high-resolution timing marks for startup profiling.
- **Render Library Code-Splitting**: Highlight.js, KaTeX, Mermaid, and Chart.js are now loaded through a dedicated `renderLibs.ts` module and split into separate async chunks by Vite, keeping the initial JS bundle smaller and improving first-render speed.

### Fixed
- **Parser & Inline Renderer Robustness**: Resolved a loading-forever hang and crashes triggered by malformed or binary file inputs. The Markdown parser now guards every token type with explicit interface definitions and safe fallbacks, and the inline renderer handles unexpected node shapes without throwing.
- **VS Code Extension Views Schema**: Added missing `icon` property to the webview view definition in `package.json` to resolve VS Code schema warnings.

### Tests
- **Desktop Module Coverage**: Added lightweight unit tests for the workspace scanner, recent workspaces list, and search index modules to catch regressions in core desktop data-layer logic.
- **Scope Focus Reconcile Tests**: Added test suite covering new-file inclusion, removed-file pruning, folder-level descendant tracking, and cross-platform path normalization for the scope focus reconcile algorithm.
- **Update Manager Tests**: Added test coverage for the full Windows portable update state machine: download progress, staging, manifest persistence, helper launch, result code reading, and edge cases like a missing staged file.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, and VS Code package metadata to `1.5.3`.

---

## [1.5.2] — 2026-06-17

### Added Features & Enhancements
- **Focus Mode**: Added a new fullscreen toggle button in the top-left of the document content area. When clicked, it opens the current file in Focus Mode, hiding the sidebar, header, and Table of Contents (TOC) panel for a clean reading interface. The layout hides all workspace controls, navigation tabs, and floating toolbars to focus strictly on markdown content.
- **Focus Mode Shortcut**: Registered a new customizable action (`toggleFocusMode`) with the default keyboard shortcut `Ctrl+Alt+F` to easily toggle the view.
- **Shortcut Registry & Translations**: Wired the Focus Mode action into the keyboard customizer under Settings and added localized translations for the setting descriptions in all 9 supported UI languages.
- **Collapsible TOC Panel**: Added a collapse/expand button to the Table of Contents panel so users can hide it entirely and reclaim horizontal reading space. The collapsed state is persisted across sessions via `localStorage` and can also be toggled with a configurable keyboard shortcut. A floating reopen button appears at the content edge when the panel is hidden; on narrow viewports, the compact TOC bar gains a matching toggle button.
- **Locate Current File in Sidebar**: Added a crosshair button in the sidebar header that scrolls the file tree to the currently open file and highlights it. Parent folders expand automatically if the file is nested inside a collapsed directory. The action is also available as a configurable keyboard shortcut in Settings → Keyboard Shortcuts.
- **New Icons**: Added `LocateIcon` (crosshair), `TocIcon`, `DoubleChevronLeftIcon`, and `DoubleChevronRightIcon` to the shared icon set.
- **Tooltip Left-Alignment**: Extended `TooltipButton` and the tooltip CSS with a `left` alignment option to prevent tooltip clipping near the right edge of the UI.
- **Shortcuts Table Driven by Action Registry**: The shortcuts reference table in the Welcome page is now generated from the same `ACTIONS_LIST` used by the Settings keyboard customizer, so newly registered actions appear automatically without manual table updates.
- **toggleToc & locateFile Actions**: Registered two new customizable keyboard actions (`toggleToc`, `locateFile`) across the action registry, keybindings, and all 9 supported UI languages.

### Changed
- **Welcome Page Recent Feature Guide**: Refreshed the "What is new" guide to cover changes from v1.5.0 onwards. Previous `Current` badge entries are now stamped with their release version (`v1.5.0`, `v1.5.1`), and two new `v1.5.2` items document the collapsible TOC and Locate File features.
- **Body Min-Size Tokens**: Added `min-width: 460px` and `min-height: 360px` to the app shell body to prevent layout collapse at very small viewport sizes.
- **Pet Theme Sidebar Border**: Scoped the sidebar resize handle background and border rule to pet themes only, restoring the correct separator style.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, and VS Code package metadata to `1.5.2`.

---

## [1.5.1] — 2026-06-16

### Added Features & Enhancements
- **Chromium Extension Variant**: Introduced a new variant of Markdown Explorer as a standalone Chromium Browser Extension, allowing users to run it directly inside Chrome, Brave, Edge, and other Chromium browsers with local file access.
- **Enhanced Chart View**: Merged the separate chart view switcher buttons into a single custom dropdown selection menu that matches the pet theme dropdown design and fits compactly next to the Wrap button.
- **Parallel Release Pipeline**: Configured a new parallel build process in the GitHub Actions workflow (`release.yml`) using Node 24 to package and release the Chromium extension.
- **K-Ink Pet Theme Polish**: Restructured pet theme CSS styles to restrict dark-mode overrides in the K-Ink theme, restoring proper high-contrast text rendering on light backgrounds when using light or auto-light modes.

### Fixed
- **Settings Translation**: Localized the Document Conversion preview setting title and description in the Settings modal for all supported languages.

---

## [1.5.0] — 2026-06-11

### Added Features & Enhancements
- **Document Conversion Preview**: Added optional Markdown previews for DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files using `@the-long-ride/markdown-them`, with loading feedback during scan and conversion work.
- **Sidebar Cursor Mode**: Added `Alt+S` sidebar keyboard navigation with highlighted focus, arrow-key movement, Enter-to-open or expand folders, Escape-to-exit, and click-outside dismissal.
- **Tab Context Menus**: Added right-click actions for content and desktop tabs: close current tab, close tabs to the right, close other tabs, and close all tabs.

### Changed
- **Sidebar Focus Treatment**: Dimmed the rest of the app and strengthened the sidebar shadow while Sidebar Cursor Mode is active, with eased transitions.
- **Converted Preview Messaging**: Localized converted-document warning text so users understand conversion preview quality may differ from the original file.
- **Welcome Guidance**: Updated the welcome page with guidance for recent features from the 1.4.5 series through this release.

### Maintenance
- **Feature Screenshots**: Refreshed README and website images for document conversion, Sidebar Cursor Mode, and Theme Remix.
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, website metadata, and lockfile metadata to `1.5.0`.

---

## [1.4.9] — 2026-06-11

### Added Features & Enhancements
- **Content File Tabs**: Added an optional VS Code-like content tab strip so opened Markdown files can create or activate document tabs instead of always replacing the current panel.
- **Scope Focus**: Added a sidebar scope focusing mode with persisted file/folder selection, folder-wide descendant toggles, hidden unselected items, and compact custom circular selection controls.
- **Settings Changelog Link**: Made the settings version note link directly to the GitHub changelog with localized tooltip text.

### Changed
- **Content Tab Strip Polish**: Updated the content tab strip with a thinner custom horizontal scrollbar, a bottom-line-only section treatment, and tab labels based on either file names or H1 titles depending on the existing label setting.

### Maintenance
- **Release Version Bump**: Updated workspace, UI, desktop, VS Code, website metadata, and lockfile metadata to `1.4.9`.

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
