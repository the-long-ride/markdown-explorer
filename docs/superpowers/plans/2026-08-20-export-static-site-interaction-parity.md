# Exported Static Site Interaction Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore interactive parity for exported HTML/static sites and fix Export Center/media/code-scroll layout regressions.

**Architecture:** Keep exported pages host-free. The always-loaded core export runtime installs one delegated DOM controller that routes Markdown Explorer-owned controls to the existing `UI` and `Table` globals at interaction time. A focused late-loaded stylesheet corrects export-only geometry without restructuring existing app styles.

**Tech Stack:** React/TypeScript, DOM APIs, Vitest/jsdom, Node test runner, CSS, existing export runtime bundles.

**Spec:** `docs/superpowers/specs/2026-08-20-export-static-site-interaction-parity-design.md`

## Global Constraints

- No CDN or host-bridge dependency in exported HTML/static sites.
- Do not reintroduce DOCX or EPUB.
- Do not break user-authored raw HTML event attributes; remove inline handlers only from Markdown Explorer-owned controls.
- Reuse existing `window.UI` and `window.Table` behavior instead of duplicating feature logic.
- Preserve the current export theme/layout pipeline.

---

### Task 1: Prove portable interaction failures

**Files:**
- Modify: `tests/unit/ui/dom/portable-runtime.test.ts`
- Create: `ui/src/dom/portableInteractionController.ts`
- Modify: `ui/src/export/runtime/entry-core.ts`

**Interfaces:**
- Produces: `installPortableInteractionController(doc?: Document, win?: PortableInteractionWindow): void`
- Consumes: existing `window.UI` and `window.Table` methods.

- [ ] **Step 1: Write the failing delegated-interaction test**

Add a Vitest case that creates section/code/table/chart controls with inline handlers, installs `installPortableInteractionController`, asserts Markdown Explorer inline handlers are removed, then dispatches click/input events and expects calls to `UI.toggleSection`, `UI.toggleCodeCollapse`, `Table.toggleCollapse`, `Table.toggleWrap`, `Table.toggleColumnMenu`, `Table.filter`, `Table.sort`, `Table.toggleViewDropdown`, `Table.switchView`, and `Table.closeViewDropdown`.

- [ ] **Step 2: Run RED verification**

Run: `pnpm run test:ui -- tests/unit/ui/dom/portable-runtime.test.ts`
Expected: FAIL because `portableInteractionController` does not exist / delegated behavior is missing.

- [ ] **Step 3: Implement the controller minimally**

Use a `WeakSet<Document>` for idempotence, remove `onclick`/`oninput` only from known Markdown Explorer control selectors, and install document-level `click` and `input` listeners. Resolve `UI`/`Table` from `win` inside each event handler so later runtime bundles are supported.

- [ ] **Step 4: Install it from the core export runtime**

`entry-core.ts` must call both `installPortableContentHandlers(document, window)` and `installPortableInteractionController(document, window)`.

- [ ] **Step 5: Run GREEN verification**

Run: `pnpm run test:ui -- tests/unit/ui/dom/portable-runtime.test.ts`
Expected: PASS.

### Task 2: Preserve custom syntax highlighting

**Files:**
- Modify: `tests/unit/ui/export/export-theme.test.ts`
- Modify: `ui/src/export/exportTheme.ts`

**Interfaces:**
- Consumes/produces existing `captureExportThemeSnapshot()` behavior.

- [ ] **Step 1: Add failing `.hl-*` portability assertion**

Extend the portable stylesheet test with `.hl-kw { color: red; }` and assert `snapshot.cssText` contains `.hl-kw`.

- [ ] **Step 2: Run RED verification**

Run: `pnpm run test:ui -- tests/unit/ui/export/export-theme.test.ts`
Expected: FAIL because `.hl-*` selectors are currently filtered out.

- [ ] **Step 3: Add `.hl-` to portable selector markers**

Keep `.hljs` behavior unchanged.

- [ ] **Step 4: Run GREEN verification**

Run: `pnpm run test:ui -- tests/unit/ui/export/export-theme.test.ts`
Expected: PASS.

### Task 3: Fix export-only geometry and collapsed-code scrolling

**Files:**
- Create: `ui/src/styles/global/global-export-runtime-followup.css`
- Modify: `ui/src/styles/global.css`
- Create: `tests/node/export-static-site-followup-contract.test.mjs`

**Interfaces:**
- Produces late CSS overrides only; no new runtime API.

- [ ] **Step 1: Add failing CSS contract**

The Node contract must assert the new stylesheet is imported and contains: topbar-safe `.export-center` flex-start/border-box rules, vertical scrolling on collapsed `.mdn-codeblock-body`, and absolute exported-media previous/next controls with a bounded media viewport/footer.

- [ ] **Step 2: Run RED verification**

Run: `pnpm run test:node -- tests/node/export-static-site-followup-contract.test.mjs`
Expected: FAIL because the follow-up stylesheet is absent.

- [ ] **Step 3: Add focused late-loaded CSS overrides**

Do not rewrite existing large style modules. The new stylesheet must load after `global-export-center.css` and `global-media-viewer-settings-shell.css`.

- [ ] **Step 4: Run GREEN verification**

Run: `pnpm run test:node -- tests/node/export-static-site-followup-contract.test.mjs`
Expected: PASS.

### Task 4: Full verification and PR update

**Files:**
- No additional production files unless verification exposes a regression.

- [ ] **Step 1: Run relevant suites**

Run: `pnpm run test:ui`, `pnpm run test:node`, `pnpm run test:contracts`, and `pnpm run build:ui`.
Expected: PASS.

- [ ] **Step 2: Push the verified tree to `feat/export-center-scope-view`**

Move the branch once, after the isolated RED/GREEN cycle is complete.

- [ ] **Step 3: Verify GitHub Actions and review state**

Wait for the exact-head workflow. Cancel superseded runs if any remain active. Trigger a fresh Greptile exact-head review and resolve any valid findings before completion.