# Electron App Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Electron desktop app open faster, keep the window responsive while workspaces load, and reduce renderer/main-process work during normal use.

**Architecture:** Measure first, then remove startup blockers. The renderer should mount and send `ready` before heavy markdown libraries load, the main process should avoid synchronous workspace/search work on the UI-critical path, and expensive document rendering features should load only when the current document needs them.

**Tech Stack:** Electron 42, React 19, Vite 8, TypeScript, Node.js built-ins, `worker_threads`, existing markdown/search/scanner modules.

---

## Current Findings

- `ui/src/contexts/AppStateContext.tsx` waits for `libsReady` before posting the Electron `ready` message.
- `ui/src/main.tsx` loads Highlight.js languages, Mermaid, ZenUML, and Chart.js on startup even when the first screen is the workspace picker.
- `ui/src/components/Content/Content.tsx` imports KaTeX in the initial renderer bundle and runs broad DOM post-processing after content renders.
- `desktop/scanner.js` scans directories synchronously and reads full markdown files with `fs.readFileSync` just to extract titles.
- `desktop/search-index.js` uses synchronous `existsSync`, `statSync`, and `readFileSync` in the main process.
- `desktop/main.js` scans inactive persisted tab workspaces in `handleLoadWorkspaceSearchIndexes`, then primes search indexes on the main thread.
- `desktop/package.json` uses Electron Builder `compression: "maximum"`, which can make portable startup/extraction slower on Windows.

## Success Targets

- App shell visible before heavy markdown libraries finish loading.
- Home/workspace selection screen receives `readyAck` without waiting for Mermaid, Chart.js, ZenUML, Highlight.js, or KaTeX.
- Selecting a workspace shows loading feedback immediately, with no main-process task blocking the window for more than 100 ms.
- Search indexing never blocks initial app open or workspace activation.
- Built renderer chunks show large markdown libraries in async chunks, not the startup entry chunk.

## Task 1: Add Startup and Runtime Measurements

**Files:**
- Create: `desktop/perf-timer.js`
- Modify: `desktop/main.js`
- Modify: `desktop/window.js`
- Modify: `ui/src/main.tsx`
- Modify: `ui/src/contexts/AppStateContext.tsx`

- [ ] Add a tiny main-process profiler gated by `MDN_PERF=1`.

```js
// desktop/perf-timer.js
const enabled = process.env.MDN_PERF === "1";
const marks = new Map();

function now() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function mark(name) {
  if (!enabled) return;
  marks.set(name, now());
  console.log(`[perf] mark ${name}`);
}

function measure(name, startName, endName = name) {
  if (!enabled) return;
  const start = marks.get(startName);
  const end = marks.get(endName) ?? now();
  if (typeof start === "number") {
    console.log(`[perf] ${name}: ${Math.round(end - start)}ms`);
  }
}

module.exports = { mark, measure };
```

- [ ] Mark Electron lifecycle points in `desktop/main.js`.

```js
const perf = require("./perf-timer");

perf.mark("main:required");

app.whenReady().then(() => {
  perf.mark("electron:ready");
  configureYouTubeEmbedHeaders(session);
  createWindow();
  perf.mark("window:created");
  perf.measure("main require to electron ready", "main:required", "electron:ready");
});
```

- [ ] Mark first load in `desktop/window.js`.

```js
const perf = require("./perf-timer");

mainWindow.webContents.on("did-finish-load", () => {
  perf.mark("renderer:did-finish-load");
  perf.measure("window create to renderer load", "window:created", "renderer:did-finish-load");
  clampAppZoom();
});
```

- [ ] Mark renderer mount and host-ready timing in `ui/src/main.tsx` and `ui/src/contexts/AppStateContext.tsx`.

```ts
if (import.meta.env.DEV || new URLSearchParams(location.search).has("perf")) {
  performance.mark("renderer:entry");
}
```

```ts
performance.mark("renderer:post-ready");
bridge.postMessage({ command: "ready", documentConversionEnabled: saved?.documentConversion });
```

- [ ] Run the baseline before changing behavior.

```powershell
$env:MDN_PERF='1'
npm run start:desktop
```

Expected: console output with `main require to electron ready`, `window create to renderer load`, and renderer marks.

## Task 2: Send `ready` Before Heavy Renderer Libraries Load

**Files:**
- Create: `ui/src/lib/renderLibs.ts`
- Modify: `ui/src/main.tsx`
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Modify: `ui/src/components/Content/Content.tsx`

- [ ] Move Highlight.js, Mermaid, ZenUML, Chart.js, and KaTeX loaders into lazy functions.

```ts
// ui/src/lib/renderLibs.ts
let highlightPromise: Promise<any> | null = null;
let mermaidPromise: Promise<any> | null = null;
let chartPromise: Promise<any> | null = null;
let katexPromise: Promise<any> | null = null;

export function getHighlightJs() {
  if (!highlightPromise) {
    highlightPromise = Promise.all([
      import("highlight.js/lib/core"),
      import("highlight.js/lib/languages/javascript"),
      import("highlight.js/lib/languages/typescript"),
      import("highlight.js/lib/languages/json"),
      import("highlight.js/lib/languages/css"),
      import("highlight.js/lib/languages/xml"),
      import("highlight.js/lib/languages/markdown"),
      import("highlight.js/lib/languages/bash"),
      import("highlight.js/lib/languages/powershell"),
      import("highlight.js/lib/languages/yaml"),
      import("highlight.js/lib/languages/python"),
    ]).then(([{ default: hljs }, ...languages]) => {
      const names = ["javascript", "typescript", "json", "css", "xml", "markdown", "bash", "powershell", "yaml", "python"];
      names.forEach((name, index) => hljs.registerLanguage(name, languages[index].default));
      hljs.registerAliases(["js", "jsx", "mjs", "cjs"], { languageName: "javascript" });
      hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
      hljs.registerAliases(["html", "xhtml", "svg"], { languageName: "xml" });
      return hljs;
    });
  }
  return highlightPromise;
}

export function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = Promise.all([
      import("mermaid"),
      import("@mermaid-js/mermaid-zenuml"),
    ]).then(async ([{ default: mermaid }, { default: zenuml }]) => {
      await mermaid.registerExternalDiagrams([zenuml]).catch(() => undefined);
      return mermaid;
    });
  }
  return mermaidPromise;
}

export function getChart() {
  if (!chartPromise) {
    chartPromise = import("chart.js").then((mod) => {
      mod.Chart.register(
        mod.ArcElement,
        mod.BarController,
        mod.BarElement,
        mod.CategoryScale,
        mod.DoughnutController,
        mod.Legend,
        mod.LineController,
        mod.LineElement,
        mod.LinearScale,
        mod.PointElement,
        mod.Tooltip,
      );
      return mod.Chart;
    });
  }
  return chartPromise;
}

export function getKatex() {
  if (!katexPromise) {
    katexPromise = import("katex").then((mod) => mod.default);
  }
  return katexPromise;
}
```

- [ ] Remove `libsReady` from `ui/src/main.tsx`; keep only React mount, bridge detection, global CSS, and platform setup on the startup path.

- [ ] In `ui/src/contexts/AppStateContext.tsx`, post `ready` immediately after the bridge message listener is registered.

```ts
const saved = bridge.getState<PersistedState>();
bridge.postMessage({
  command: "ready",
  documentConversionEnabled:
    typeof saved?.documentConversion === "boolean" ? saved.documentConversion : undefined,
});
```

- [ ] In `ui/src/components/Content/Content.tsx`, load libraries only when matching DOM exists.

```ts
const codeBlocks = [...body.querySelectorAll<HTMLElement>("pre code:not([data-highlighted])")];
if (codeBlocks.length > 0) {
  const hljs = await getHighlightJs();
  codeBlocks.forEach((block) => hljs.highlightElement(block));
}

const mathEls = [...body.querySelectorAll<HTMLElement>(".mdn-math[data-math]")];
if (mathEls.length > 0) {
  const katex = await getKatex();
  mathEls.forEach((el) => katex.render(decodeURIComponent(el.dataset.math || ""), el, { throwOnError: false }));
}
```

- [ ] Verify bundle splitting.

```powershell
npm run build --workspace=ui
Get-ChildItem ui\dist\assets | Sort-Object Length -Descending | Select-Object Name,Length
```

Expected: Mermaid, Chart.js, Highlight.js, and KaTeX appear in separate async chunks and the startup entry chunk is smaller.

## Task 3: Make Workspace Scanning Non-Blocking

**Files:**
- Create: `desktop/workspace-worker.js`
- Create: `desktop/workspace-jobs.js`
- Modify: `desktop/main.js`
- Modify: `desktop/scanner.js`

- [ ] Move workspace scanning into a worker thread.

```js
// desktop/workspace-worker.js
const { parentPort } = require("worker_threads");
const DesktopScanner = require("./scanner");

parentPort.on("message", (job) => {
  try {
    if (job.type === "scanWorkspace") {
      const result = DesktopScanner.scan(job.workspacePath, {
        documentConversionEnabled: job.documentConversionEnabled === true,
      });
      parentPort.postMessage({ id: job.id, ok: true, result });
    }
  } catch (err) {
    parentPort.postMessage({
      id: job.id,
      ok: false,
      error: { message: err.message, code: err.code },
    });
  }
});
```

- [ ] Add `desktop/workspace-jobs.js` to run one scan at a time and terminate stale scans when the user switches workspaces.

- [ ] Change `sendWorkspaceData()` in `desktop/main.js` to `await runWorkspaceScan(...)` instead of calling `scanWorkspaceData(...)` directly.

- [ ] In `desktop/scanner.js`, stop reading entire markdown files for titles. Read only the first 64 KiB.

```js
static readTitleChunk(fsPath) {
  const fd = fs.openSync(fsPath, "r");
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}
```

- [ ] Keep loading feedback immediate by sending `setLoading` before starting the worker scan.

- [ ] Verify a large workspace remains responsive while scanning.

```powershell
$env:MDN_PERF='1'
npm run start:desktop
```

Expected: the window can minimize, move, and close while a large workspace is loading.

## Task 4: Defer Search Indexing Until Search Needs It

**Files:**
- Modify: `desktop/search-index.js`
- Modify: `desktop/main.js`
- Modify: `ui/src/hooks/useDesktopTabs.ts`
- Modify: `ui/src/components/Search/SearchOverlay.tsx`

- [ ] Remove automatic cross-tab search priming from the initial tab restore path in `useDesktopTabs.ts`.

- [ ] Trigger search priming from `SearchOverlay.tsx` only when the search UI opens or when the user types a query of at least two characters.

- [ ] Reduce main-process search batches and skip oversized text files.

```js
const MAX_INDEXABLE_BYTES = 2 * 1024 * 1024;
const PRIME_BATCH_SIZE = 5;

if (stat.size > MAX_INDEXABLE_BYTES) {
  return null;
}
```

- [ ] Keep search results correct by preserving on-demand indexing inside `search(query, items, limit)`.

- [ ] Verify search behavior.

```powershell
npm run build --workspace=ui
$env:MDN_PERF='1'
npm run start:desktop
```

Expected: app startup does not log search-index work before the user opens search; current-workspace and all-tabs search still return results after typing.

## Task 5: Reduce Renderer Content Work Per Render

**Files:**
- Modify: `ui/src/components/Content/Content.tsx`
- Modify: `ui/src/components/Content/InteractiveComponents.ts`

- [ ] Gate every content enhancement by DOM presence: code highlighting, math rendering, Mermaid rendering, chart detection, iframe theme sync, and table collapse.

- [ ] Use one scoped query per feature and avoid document-level lookups where the current `bodyRef` can be used.

- [ ] Schedule non-critical chart detection with `requestIdleCallback` when available.

```ts
const scheduleIdle = window.requestIdleCallback
  ? window.requestIdleCallback
  : (callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 1 }), 1);
```

- [ ] Cancel pending async work when `state.currentFile` or `state.renderVersion` changes.

- [ ] Verify documents with no diagrams, math, or charts do not load those chunks.

```powershell
npm run build --workspace=ui
```

Expected: opening a simple markdown document only loads the entry, CSS, and Highlight.js if code blocks are present.

## Task 6: Improve Sidebar and Tab Restore Work

**Files:**
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/components/Sidebar/TreeNode.tsx`
- Modify: `ui/src/hooks/useDesktopTabs.ts`

- [ ] Render only expanded tree branches in `TreeNode.tsx`; keep collapsed branch children out of the React tree.

- [ ] Keep tab snapshots small by storing workspace identity, current file, and visible metadata; avoid persisting full `contentHtml` and `markdownSource` for every inactive tab unless needed for instant tab switching.

- [ ] Restore inactive workspace tabs as lightweight shells, then load their `fileList` and `tree` only after the tab becomes active or search asks for all-tabs data.

- [ ] Verify with a workspace near the scanner limit of 1000 files.

```powershell
$env:MDN_PERF='1'
npm run start:desktop
```

Expected: switching to tab view does not trigger immediate scans for every saved inactive workspace.

## Task 7: Review Electron Packaging for Startup Cost

**Files:**
- Modify: `package.json`
- Modify: `desktop/package.json`

- [ ] Change desktop build to use the Electron-targeted UI build.

```json
{
  "scripts": {
    "build:ui:electron": "npm run build:electron --workspace=ui",
    "build:desktop": "npm run build:ui:electron && npm run build:vscode && npm run dist --workspace=desktop"
  }
}
```

- [ ] Benchmark Windows portable startup with `compression: "maximum"` and `compression: "normal"` in `desktop/package.json`.

- [ ] Keep the compression setting that gives the best user startup time, not only the smallest package.

- [ ] Verify packaged output.

```powershell
npm run build:desktop
```

Expected: packaged app launches successfully and uses the same lazy chunk behavior as development.

## Task 8: Final Verification Matrix

**Files:**
- Modify: `README.md` only if user-facing launch behavior changes.
- Modify: `CHANGELOG.md` only when preparing a release.

- [ ] Run TypeScript and Vite build.

```powershell
npm run build --workspace=ui
```

- [ ] Run desktop package build.

```powershell
npm run build:desktop
```

- [ ] Manually verify these workflows:
  - Open app with no workspace selected.
  - Open a small markdown workspace.
  - Open a large workspace with hundreds of markdown files.
  - Open a markdown file with code blocks.
  - Open a markdown file with KaTeX math.
  - Open a markdown file with Mermaid diagrams.
  - Open a markdown file with chartable tables.
  - Use current workspace search.
  - Use all-tabs search.
  - Restore saved desktop tabs after restart.

- [ ] Compare before/after metrics from `MDN_PERF=1`.

Expected: startup-critical marks improve, heavy libraries load only after matching content requires them, and workspace/search work no longer blocks the main Electron window.

