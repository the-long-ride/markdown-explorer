# Bug Investigation Report — `vscode-extension-markdown-explorer`

## Summary

Five distinct bugs were identified across the shared UI, the VS Code extension, and the Electron desktop app. Each bug has a clear root cause traced to specific files.

---

## Bug 1 — Charts (Bar / Line / Pie / Table switcher) are missing

**Affects:** Both VS Code extension and Electron desktop app.

### Root Cause

`ui/index.html` loads `chart.js` and `mermaid` via **CDN `<script>` tags**:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

These CDN scripts expose `window.Chart` and `window.mermaid`.

`Content.tsx` then reads them as:

```ts
const mermaid = (window as any).mermaid;  // captured at module load time
```

And `App.tsx` checks `typeof win.Chart !== 'undefined'` before instantiating charts.

**However**, the Vite build at `ui/package.json` also lists both libraries as proper npm dependencies (`"mermaid": "^11.6.0"`, `"chart.js": "^4.4.9"`). Vite bundles them into the JS bundle — but **never assigns them to `window`**, so `window.Chart` and `window.mermaid` remain `undefined` at runtime after the build.

Meanwhile, the CDN scripts are still present in the built `dist/index.html`. In the VS Code extension webview, the CSP injected by `panel.ts` is:

```
script-src 'unsafe-inline' <vscodeWebviewResourceScheme>
```

This **blocks all `cdn.jsdelivr.net` requests**, so the CDN scripts silently fail to load. Result: `window.Chart === undefined`, `window.mermaid === undefined` → charts never render, mermaid diagrams never render.

In the Electron desktop app, there is no explicit CSP, so CDN scripts _can_ load — but only when the machine has internet access, and only if no bundler conflict arises. This makes it intermittent.

### Fix

**Option A (recommended) — Remove CDN scripts, import from npm and expose to window in `main.tsx`:**

Remove the three CDN `<script>` tags from `ui/index.html`, then add explicit window assignments in `ui/src/main.tsx`:

```ts
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import Chart from 'chart.js/auto';

(window as any).hljs = hljs;
(window as any).mermaid = mermaid;
(window as any).Chart = Chart;
```

This ensures the libraries are always available offline, bundled, and CSP-safe.

**Option B — Keep CDN but mark libraries as externals in Vite and add them to CSP:**

Add `cdn.jsdelivr.net` to the `connect-src` / `script-src` directives in `panel.ts`, and declare them as Vite externals so they don't get double-bundled. This approach is fragile (network dependency) and conflicts with the "100% offline" privacy claim.

---

## Bug 2 — Mermaid diagrams not rendering

**Affects:** Both VS Code extension and Electron desktop app.

### Root Cause

Same root cause as Bug 1: `window.mermaid` is `undefined` because CDN is blocked by CSP in VS Code, and the npm-bundled `mermaid` is never assigned to `window`.

There is an additional secondary issue in `Content.tsx`:

```ts
const mermaid = (window as any).mermaid;  // captured once at module load (top-level)
```

This value is captured **once when the module first loads**, not re-checked on each render. If `window.mermaid` were to be set after the module loads (e.g., from a CDN script that loads late), the captured `const mermaid` would still be `undefined`.

### Fix

Same as Bug 1. Additionally, change the top-level capture in `Content.tsx` to read `window.mermaid` inside the `useEffect` so it's evaluated at call time:

```ts
// Inside the useEffect, not at module top level:
const mermaid = (window as any).mermaid;
if (mermaid) { ... }
```

---

## Bug 3 — Table "Show More / Show Less" rows not working

**Affects:** Both VS Code extension and Electron desktop app.

### Root Cause

The logic is split across two places and has a race condition.

In `renderer.ts` (`renderTable`), the HTML is generated with all rows in the `<tbody>` and a toggle button:
```ts
const toggleBtnHtml = token.rows.length > 15
  ? `<button ... onclick="Table.toggleCollapse('${id}')">Show More</button>`
  : '';
```

In `Content.tsx` (`useEffect`), after the HTML is injected, the code tries to apply the collapse:
```ts
if (total > 15) {
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    if (index >= 15) row.classList.add('is-collapsed-row');
  });
  const btn = document.getElementById(table.id + '-toggle-btn');
  if (btn) {
    btn.style.display = '';
    btn.textContent = 'Show More';
  }
}
```

The CSS for `.is-collapsed-row` sets `display: none`. This looks correct, **but** the `useEffect` dependency array is:

```ts
}, [state.renderVersion, state.theme, state.isLoading, state.notFoundHref, onImageClick, scrollRef, bridge]);
```

`state.renderVersion` is the trigger. If this effect runs **before** the HTML from `dangerouslySetInnerHTML` is fully committed to the DOM (React batches updates), the `querySelectorAll` finds no rows yet. The collapse never gets applied.

There is also a logic bug in `Table.toggleCollapse`: it correctly toggles rows, but when returning to the table view from a chart view (`switchView` → `'table'`), the collapsed rows are shown again because `switchView` only manages `scrollEl.style.display` without re-applying the collapse state:

```ts
if (view === 'table') {
  if (scrollEl) scrollEl.style.display = '';
  // Missing: re-apply is-collapsed-row based on state.expanded
}
```

### Fix

1. In `Content.tsx`, wrap the table initialization in a `requestAnimationFrame` or `setTimeout(fn, 0)` to ensure the DOM is settled before querying it:

```ts
requestAnimationFrame(() => {
  body.querySelectorAll<HTMLElement>('.mdn-table').forEach((table) => {
    // ... collapse and chart detection logic
  });
});
```

2. In `App.tsx` `Table.switchView`, after restoring the table view, re-apply collapsed rows:

```ts
if (view === 'table') {
  if (scrollEl) scrollEl.style.display = '';
  if (chartContainer) chartContainer.style.display = 'none';
  // Re-apply collapsed state
  const rows = table.querySelectorAll('tbody tr');
  const totalRows = rows.length;
  if (totalRows > 15 && !state.expanded) {
    rows.forEach((row, idx) => {
      if (idx >= 15) (row as HTMLElement).classList.add('is-collapsed-row');
    });
    if (toggleBtn) { toggleBtn.style.display = ''; toggleBtn.textContent = 'Show More'; }
  }
}
```

---

## Bug 4 — Electron drag-and-drop of files/folders does nothing

**Affects:** Electron desktop app only.

### Root Cause

There is **no drag-and-drop event handler anywhere** in the codebase:

- `desktop/main.js` has zero references to `dragover`, `drop`, `dragenter`, or any file drop IPC.
- `desktop/preload.js` exposes only `postMessage` and `onMessage` — no file drop API.
- `WorkspaceSelection.tsx` (the landing screen) has no `onDrop` / `onDragOver` handlers.
- The `WorkspaceSelection` div has `WebkitAppRegion: 'drag'` set on the titlebar — this is for **window dragging**, not file dropping, and actually **suppresses** normal drag events in that region.

The random triggering of a drop-style visual when opening an image is almost certainly the browser's default drag-over visual leaking through (Electron doesn't suppress `dragover` on the `<body>` by default), unrelated to any actual handling.

### Fix

Add proper file/folder drop support in three places:

**1. `desktop/preload.js`** — expose a method to send drop events:
```js
// Already covered by existing postMessage — no change needed
```

**2. `WorkspaceSelection.tsx`** — add `onDragOver` + `onDrop` to the root container:
```tsx
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const items = Array.from(e.dataTransfer.files);
  if (items.length === 0) return;
  // Send the first dropped path (file or directory)
  bridge.postMessage({ command: 'dropOpen', path: (items[0] as any).path });
};
```

**3. `desktop/main.js`** — handle the `dropOpen` command in the `ipcMain.on('webview-message')` switch:
```js
case 'dropOpen':
  const droppedPath = msg.path;
  if (fs.existsSync(droppedPath)) {
    const stat = fs.statSync(droppedPath);
    if (stat.isDirectory()) {
      saveRecentWorkspace(droppedPath);
      activeWorkspace = droppedPath;
      currentFile = null;
      sendWorkspaceData().then(() => sendWelcome());
    } else if (stat.isFile() && /\.(md|mdx)$/i.test(droppedPath)) {
      const folderPath = path.dirname(droppedPath);
      saveRecentWorkspace(folderPath);
      activeWorkspace = folderPath;
      currentFile = droppedPath;
      sendWorkspaceData().then(() => sendContent());
    }
  }
  break;
```

Also, add this to the `<body>` in the Electron window to prevent the browser's own default drop behavior from interfering:
```js
// In createWindow() after loadFile:
mainWindow.webContents.on('did-finish-load', () => {
  mainWindow.webContents.executeJavaScript(`
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());
  `);
});
```

---

## Bug 5 — VS Code extension package contains `.ttf` font files

**Affects:** VS Code extension (`.vsix`) only.

### Current State

`ui/assets/fonts/` contains 7 `.ttf` files (BeVietnamPro and CascadiaCode variants). The `.vscodeignore` file has two relevant lines:

```
ui/assets/fonts/
ui/dist/assets/*.ttf
```

The first line (`ui/assets/fonts/`) excludes the source font folder. The second line (`ui/dist/assets/*.ttf`) tries to exclude any TTFs that end up in the Vite dist output. **However**, if Vite's asset pipeline copies or inlines `.ttf` files from the `assets/fonts/` source into `ui/dist/assets/`, the glob `ui/dist/assets/*.ttf` should catch them — but only if they land directly in that folder and not in a subdirectory.

More importantly, `global.css` likely references these fonts with `@font-face` declarations. Since Vite processes CSS, it may copy the TTFs into `dist/assets/` with hashed names. The `.vscodeignore` glob should cover that, but should be verified.

### Fix

**In the VS Code extension build, remove all `@font-face` declarations from `global.css`** (or move them to a separate CSS file included only for the Electron build). Replace custom fonts with VS Code's own CSS variables:

```css
/* Instead of @font-face + custom font-family: */
:root {
  --font-ui: var(--vscode-font-family, -apple-system, 'Segoe UI', system-ui, sans-serif);
  --font-mono: var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', Consolas, monospace);
}
```

This lets VS Code supply whatever font the user has configured in their IDE, which is both lighter and the correct user-experience for an extension.

To keep custom fonts only in the Electron build, use a build-time flag in `vite.config.ts`:

```ts
// vite.config.ts
const isElectron = process.env.BUILD_TARGET === 'electron';

export default defineConfig({
  define: {
    '__USE_CUSTOM_FONTS__': isElectron,
  },
  // ...
});
```

Then in CSS, conditionally include the `@font-face` block, or simply strip it during the VS Code build via a PostCSS plugin or a separate entry CSS.

Also add this belt-and-suspenders entry to `.vscodeignore` to be safe against any subdirectory placement:

```
ui/dist/**/*.ttf
ui/dist/**/*.woff
ui/dist/**/*.woff2
```

---

## Summary Table

| # | Bug | Location | Root Cause |
|---|-----|----------|------------|
| 1 | Charts not rendering | `ui/index.html`, `vscode/src/core/panel.ts` | CDN scripts blocked by VS Code CSP; npm-bundled Chart.js never assigned to `window` |
| 2 | Mermaid not rendering | `ui/index.html`, `ui/src/components/Content/Content.tsx` | Same as above; also `window.mermaid` captured too early |
| 3 | Show More/Less rows | `ui/src/components/Content/Content.tsx`, `ui/src/App.tsx` | DOM not ready when `useEffect` queries rows; collapsed state lost on chart→table switch |
| 4 | Electron drag-and-drop silent | `desktop/main.js`, `WorkspaceSelection.tsx` | No `onDrop`/`dragover` handler anywhere; `WebkitAppRegion: drag` suppresses events in titlebar |
| 5 | TTF fonts in VS Code VSIX | `ui/src/styles/global.css`, `vscode/.vscodeignore` | Custom `@font-face` fonts should not ship with extension; extension should use VS Code font variables |
