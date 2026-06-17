# Design Spec: Table of Contents & Sidebar Scroll Controls

## Goal
Add user-friendly controls to toggle the Table of Contents (TOC) panel and scroll the sidebar tree to the active file.

## User Interface & Experience
1. **Table of Contents Panel Toggle**:
   - Keyboard shortcut `Ctrl + T` to hide/show the TOC panel.
   - When the TOC panel is visible, show a close button using a **double arrow right icon** next to the count badge in the header row.
   - When the TOC panel is hidden/collapsed, show an open button using a **double arrow left icon** placed absolutely below the app headerbar in the right corner (inside `.content-shell__main`).
   - Both buttons contain only icons (no text labels), use tooltips for explanation, and are aligned to prevent clipping.
2. **Sidebar Scroll**:
   - A scroll-to-active button (target icon) is placed next to the `FILES` header in the sidebar tree, using a right-aligned tooltip to prevent clipping.
   - Clicking it scrolls the sidebar smoothly so that the active file node is in the **middle of the screen** (`block: 'center'`).
   - Closed parent folders containing the active file automatically expand when the active file changes, ensuring it is rendered.
3. **Keybinding Adjustments**:
   - `Ctrl + B` is the default keybinding to toggle the sidebar in the desktop application (replacing `Ctrl + Shift + P`).

## Proposed Changes

### 1. Dictionary & Translations
- Update [translations.ts](file:///f:/my-repos/markdown-explorer/ui/src/contexts/translations.ts):
  - Add `toggleToc` actions translations for all languages.
  - Add `locateFile` tooltips translations for all languages.

### 2. State & Context Management
- Update [appStateConstants.ts](file:///f:/my-repos/markdown-explorer/ui/src/contexts/appStateConstants.ts):
  - Add `toggleToc: 'Ctrl+T'` to `DEFAULT_KEYBINDINGS`.
  - Add `toggleSidebar: 'Ctrl+B'` to `DESKTOP_DEFAULT_KEYBINDINGS`.
- Update [AppStateContext.tsx](file:///f:/my-repos/markdown-explorer/ui/src/contexts/AppStateContext.tsx):
  - Add `tocCollapsed: boolean` to `AppState`.
  - Add `TOGGLE_TOC` action and reducer logic (persisted to `localStorage` under `markdown-explorer-toc-collapsed`).
  - Add `toggleToc()` function to the context value.

### 3. UI Components
- Update [icons.tsx](file:///f:/my-repos/markdown-explorer/ui/src/components/shared/icons.tsx):
  - Export `LocateIcon` (target/crosshairs).
  - Export `TocIcon` (right layout sidebar).
- Update [TableOfContents.tsx](file:///f:/my-repos/markdown-explorer/ui/src/components/TOC/TableOfContents.tsx):
  - Add close button in `toc-panel__title-row` next to the count badge.
- Update [TreeNode.tsx](file:///f:/my-repos/markdown-explorer/ui/src/components/Sidebar/TreeNode.tsx):
  - Add `useEffect` in `FolderNodeView` to auto-expand parent folders of `state.currentFile`.
- Update [Sidebar.tsx](file:///f:/my-repos/markdown-explorer/ui/src/components/Sidebar/Sidebar.tsx):
  - Add locate button next to `FILES` title.
  - Implement `scrollToActiveFile` using `requestAnimationFrame` and smooth scrolling.
- Update [App.tsx](file:///f:/my-repos/markdown-explorer/ui/src/App.tsx):
  - Conditionally render `.toc-panel` and `.toc-resize` only when `!state.tocCollapsed`.
  - Render a floating open button inside `.content-shell` when `state.tocCollapsed && state.toc.length > 0`.
  - Wire `toggleToc` shortcut to the keyboard hook.

### 4. Styles
- Update [global-layout-sidebar.css](file:///f:/my-repos/markdown-explorer/ui/src/styles/global/global-layout-sidebar.css) and [global-tables-b.css](file:///f:/my-repos/markdown-explorer/ui/src/styles/global/global-tables-b.css):
  - Add styles for `.sidebar__locate-btn`, `.toc-panel__close-btn`, and `.toc-panel__open-btn`.
