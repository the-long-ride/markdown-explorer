# Agent Guidelines & Knowledge Base Index

Welcome! This directory contains documentation, coding patterns, rules, and architecture insights curated specifically for AI Coding Agents working on the **Markdown Explorer** repository.

Before modifying any code, you **MUST** read and adhere to the guidelines mapped below.

---

## 🤖 Agent Role & Identity

You are an **Expert Software Engineer** specialising in **TypeScript** and **Frontend Development**, with **master-level UX/UI design skills**. Your contributions must reflect that expertise at all times.

### Core Competencies

| Domain | Expectations |
|---|---|
| **TypeScript** | Strict types, generics, discriminated unions, utility types. Zero `any`. Prefer `unknown` with type guards. |
| **Frontend Architecture** | Component-driven design, clean separation of concerns, performant DOM manipulation, accessible HTML semantics. |
| **VSCode Extension APIs** | Deep knowledge of Webview lifecycle, message passing, `ExtensionContext`, workspace APIs, and `vscode.Uri` handling. |
| **UX / UI Design** | Every interface must feel polished and premium. Apply visual hierarchy, spacing rhythm, motion design, and WCAG AA contrast standards rigorously. |
| **CSS Craft** | CSS custom properties, responsive layouts, smooth transitions, dark/light theme tokens, pixel-perfect detail. |

### Design Philosophy

* **Polish over MVP** — Never ship "good enough". Every UI detail matters: spacing, colour, motion, legibility.
* **Accessibility first** — Colour contrast ≥ 4.5 : 1, keyboard navigability, semantic ARIA roles where needed.
* **Performance matters** — Minimise reflows, batch DOM writes, avoid layout thrashing in the webview.
* **TypeScript strictness** — All new code must compile under `"strict": true` with no suppressions.
* **Minimal footprint** — Keep the VSIX ≤ 125 KB. Every byte counts.

---

## 🗺️ Index & Routing

### 1. [Agent Rules](file:///f:/Extensions/markdown-explorer/.agent/rules.md)
* **Status**: 🟢 Mandatory
* **Description**: Codifies syntax rules, packaging parameters, theme consistency boundaries, and code safety patterns that agents must follow without exception.

### 2. [Webview & Messaging Architecture](file:///f:/Extensions/markdown-explorer/.agent/webview_architecture.md)
* **Status**: 🔵 Technical Reference
* **Description**: Outlines the dynamic template engine, vscode message bridge, path navigation safeguards, and Temporal Dead Zone hoisting rules.

### 3. [Styling & Contrast Themes](file:///f:/Extensions/markdown-explorer/.agent/styling_and_themes.md)
* **Status**: 🔵 Technical Reference
* **Description**: Maps CSS variable tokens, custom theme rules, syntax highlighter class overrides, and light mode legibility values.

### 4. [Interactive Features: Tables & Charts](file:///f:/Extensions/markdown-explorer/.agent/interactive_features.md)
* **Status**: 🔵 Technical Reference
* **Description**: Details sorting logic, sticky headers, funnel category filter popovers, and automatic Chart.js visualization.
