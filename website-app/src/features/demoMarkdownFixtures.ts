// =============================================================================
// website-app/src/features/demoMarkdownFixtures.ts
// Curated realistic Markdown, HTML, recent workspaces, and tree for live demos.
// =============================================================================

import type { FolderNode, MdFile, RecentWorkspace } from '../../../ui/src/types';
import { BrowserScanner } from '../scanner';

export interface DemoDocFixture {
  readonly path: string;
  readonly name: string;
  readonly title: string;
  readonly markdown: string;
  readonly oldMarkdown?: string;
  readonly newMarkdown?: string;
}

export interface DemoRecentWorkspace extends RecentWorkspace {
  readonly docCount: number;
}

export const DEMO_WORKSPACE_PATH = '/workspace/markdown-explorer-demo';
export const DEMO_WORKSPACE_NAME = 'markdown-explorer-demo';

const nowMs = 1731880000000;

export const DEMO_RECENT_WORKSPACES: readonly DemoRecentWorkspace[] = [
  {
    name: DEMO_WORKSPACE_NAME,
    path: DEMO_WORKSPACE_PATH,
    lastOpened: nowMs - 5 * 60 * 1000,
    docCount: 4,
  },
  {
    name: 'benchmarks-suite',
    path: '/workspace/benchmarks-suite',
    lastOpened: nowMs - 3 * 3600 * 1000,
    docCount: 12,
  },
  {
    name: 'release-engineering',
    path: '/workspace/release-engineering',
    lastOpened: nowMs - 28 * 3600 * 1000,
    docCount: 9,
  },
];

export { DEMO_HTML_PREVIEW } from './demoHtmlSandboxFixture';

const ARCHITECTURE_MD = `---
title: Architecture Overview
tags: [architecture, mermaid, katex, markdown]
aliases: [Architecture Guide]
status: production
---

# Architecture Overview

Markdown Explorer renders local documentation folders into an interactive, zero-telemetry workspace across **Tauri**, **Electron**, **VS Code**, and the **Browser**.

> [!TIP]
> Click any Mermaid diagram below to open the pan-and-zoom lightbox, or hover any code fence to copy it cleanly.

## Runtime Pipeline

\`\`\`mermaid
flowchart LR
  FS[Local Folder / Virtual FS] --> Scanner[Fast Workspace Scanner]
  Scanner --> Parser[Unified Markdown + MDX Parser]
  Parser --> Mermaid[Mermaid & KaTeX Engine]
  Parser --> Tables[Interactive Tables & Chart.js]
  Scanner --> Insights[Offline Insights Worker]
\`\`\`

## Indexing Complexity & Math

Search scoring combines token frequency $tf(t, d)$ with inverse document rarity across $N$ files:

$$
\\text{score}(q, d) = \\sum_{t \\in q} \\text{tf}(t, d) \\cdot \\ln\\left(1 + \\frac{N - df(t) + 0.5}{df(t) + 0.5}\\right)
$$

## Typed Host Bridge

\`\`\`typescript
export interface HostBridge {
  navigate(path: string): void;
  searchWorkspace(query: string): Promise<SearchHit[]>;
  renderDocument(path: string, theme: 'dark' | 'light'): string;
}
\`\`\`

\`\`\`rust
pub fn resolve_workspace_path(root: &Path, relative: &str) -> Result<PathBuf, FsError> {
    let candidate = root.join(relative);
    if !candidate.starts_with(root) {
        return Err(FsError::OutsideWorkspace);
    }
    Ok(candidate)
}
\`\`\`

## Connected Specs

- Benchmark data & charts: [[metrics-benchmarks]]
- Release checklist & diffs: [Release Playbook](./release-playbook.md)
- Theme tokens & shortcuts: [Design System & Themes](./design-system-themes.md)
- Pending archive link (for Insights lint demo): [Legacy Roadmap](./legacy-roadmap.md)
`;

const METRICS_MD = `---
title: Metrics & Benchmarks
tags: [benchmarks, tables, charts, performance]
aliases: [Performance Metrics]
---

# Metrics & Benchmarks

Explore interactive column sorting, multi-select value filters, and instant **Chart.js** generation directly from Markdown tables, CSV fences, and TSV blocks.

## Engine Comparison Table

| Runtime | Cold Start (ms) | Idle RAM (MB) | Bundle Size (MB) | Search 1k Docs (ms) | Offline |
| --- | ---: | ---: | ---: | ---: | --- |
| Rust Tauri | 180 | 42 | 9.4 | 14 | Yes |
| Electron | 640 | 148 | 89.0 | 16 | Yes |
| VS Code Webview | 210 | 38 | 4.2 | 19 | Yes |
| Browser Web App | 140 | 31 | 1.8 | 22 | Yes |

## Quarterly Throughput (CSV Fence)

\`\`\`csv
Quarter,Tauri_MB,Electron_MB,Docs_Indexed,Search_Ms
Q1,48,162,400,21
Q2,45,156,750,18
Q3,43,151,1200,15
Q4,42,148,1850,14
\`\`\`

## Platform Target Matrix (TSV Fence)

\`\`\`tsv
Platform	Installer	AutoUpdate	LocalSearch
Windows	NSIS / MSI	Yes	BM25 + Regex
macOS	Universal DMG	Yes	BM25 + Regex
Linux	AppImage / DEB	Yes	BM25 + Regex
\`\`\`

See [[architecture-overview]] for the scanner pipeline and [Release Playbook](./release-playbook.md) for verification gates.
`;

const RELEASE_OLD_MD = `---
title: Release Playbook
tags: [release, workflow, git, checklist]
---

# Release Playbook

Standard operating checklist for cutting a Markdown Explorer release across desktop and web targets.

## Release Pipeline

1. Bump version across workspace manifests.
2. Run \`pnpm run test:contracts\` and \`pnpm --dir ui exec tsc --noEmit\`.
3. Build Electron installers for Windows and macOS.

#### Rollback Checklist

- Tag previous stable commit as \`hotfix-base\`.
- Pause GitHub Pages deployment workflow.

## Verification Checklist

Every release candidate must verify source line-count limits, strict TypeScript typechecking, localized website assets, offline Mermaid diagram rendering, interactive table filters, and workspace link integrity before publishing signed artifacts to GitHub Releases.
`;

const RELEASE_NEW_MD = `---
title: Release Playbook
tags: [release, workflow, git, checklist]
---

# Release Playbook

Automated operating checklist for cutting a Markdown Explorer release across **Rust Tauri**, **Electron**, **VS Code**, and **GitHub Pages**.

## Release Pipeline

1. Synchronize version metadata with \`pnpm run sync-versions\`.
2. Run \`pnpm run test:contracts\`, \`pnpm run test:website\`, and \`pnpm --dir website-app typecheck\`.
3. Build signed Rust Tauri bundles (\`.exe\`, \`.dmg\`, \`.AppImage\`, \`.deb\`) alongside Electron packages.
4. Deploy interactive feature demos and the web app to GitHub Pages.

#### Rollback Checklist

- Tag previous stable commit as \`hotfix-base\` and verify checksums.
- Revert the release tag and notify package store channels.

## Verification Checklist

Every release candidate must verify source line-count limits, strict TypeScript typechecking, localized website assets, offline Mermaid diagram rendering, interactive table filters, and workspace link integrity before publishing signed artifacts to GitHub Releases.
`;

const THEMES_MD = `---
title: Design System & Themes
tags: [themes, design, shortcuts, architecture]
aliases: [Theme Guide]
---

# Design System & Themes

Markdown Explorer ships with 9 curated theme styles built on shared CSS custom properties so surfaces, borders, code blocks, and charts adapt cleanly between **Dark**, **Light**, and **Auto** modes.

## Included Theme Styles

| Style ID | Visual Identity | Corner Radius | Accent Signal |
| --- | --- | --- | --- |
| \`raw-grid\` | Mechanical grid & crisp frames | 0px | Signal Orange |
| \`cyberpunk\` | Chamfered cyberdeck HUD | 0px | Signal Yellow |
| \`tokyo-night\` | Deep night synthwave contrast | 6px | Electric Blue |
| \`vercel\` | Monochrome geometric minimalism | 6px | Crisp Neutral |
| \`bento\` | Modular bento card surfaces | 10px | Warm Amber |
| \`neon-voltage\` | High-contrast dark neon | 8px | Coral & Teal |
| \`default\` | Explorer Classic balanced reader | 8px | Cobalt Blue |
| \`pet-k-ink\` | Expressive anime companion HUD | 10px | Warm Amber |
| \`pet-white-shiba\` | Playful Shiba companion accents | 12px | Cozy Apricot |

## Verification Checklist

Every release candidate must verify source line-count limits, strict TypeScript typechecking, localized website assets, offline Mermaid diagram rendering, interactive table filters, and workspace link integrity before publishing signed artifacts to GitHub Releases.

## Related Guides

Jump back to [[architecture-overview]] or inspect [[metrics-benchmarks]].
`;

const MATH_LATEX_MD = `---
title: Math & LaTeX
tags: [katex, latex, math, formulas]
aliases: [LaTeX Equations]
---

# Math & LaTeX Rendering

Markdown Explorer bundles **KaTeX** offline so inline expressions like $E = mc^2$, $\\mathcal{O}(n \\log n)$, and $\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$ render with zero network requests.

## Workspace Search Ranking (BM25)

$$
\\operatorname{score}(D, Q) = \\sum_{i=1}^{n} \\operatorname{IDF}(q_i) \\cdot \\frac{f(q_i, D) \\cdot (k_1 + 1)}{f(q_i, D) + k_1 \\cdot \\left(1 - b + b \\cdot \\frac{|D|}{\\operatorname{avgdl}}\\right)}
$$

## Calculus, Series & Linear Algebra

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}, \\qquad e^{i\\theta} = \\cos\\theta + i\\sin\\theta
$$

$$
\\mathbf{R}(\\theta) = \\begin{bmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{bmatrix}, \\qquad \\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}
$$
`;

export const DEMO_DOCS: Record<string, DemoDocFixture> = {
  'docs/architecture-overview.md': {
    path: 'docs/architecture-overview.md',
    name: 'architecture-overview.md',
    title: 'Architecture Overview',
    markdown: ARCHITECTURE_MD,
  },
  'docs/metrics-benchmarks.md': {
    path: 'docs/metrics-benchmarks.md',
    name: 'metrics-benchmarks.md',
    title: 'Metrics & Benchmarks',
    markdown: METRICS_MD,
  },
  'docs/math-latex.md': {
    path: 'docs/math-latex.md',
    name: 'math-latex.md',
    title: 'Math & LaTeX',
    markdown: MATH_LATEX_MD,
  },
  'docs/release-playbook.md': {
    path: 'docs/release-playbook.md',
    name: 'release-playbook.md',
    title: 'Release Playbook',
    markdown: RELEASE_NEW_MD,
    oldMarkdown: RELEASE_OLD_MD,
    newMarkdown: RELEASE_NEW_MD,
  },
  'docs/design-system-themes.md': {
    path: 'docs/design-system-themes.md',
    name: 'design-system-themes.md',
    title: 'Design System & Themes',
    markdown: THEMES_MD,
  },
};

export const DEMO_FILES: MdFile[] = Object.values(DEMO_DOCS).map((doc, idx) => ({
  fsPath: doc.path,
  relativePath: doc.path,
  parts: doc.path.split('/'),
  fileName: doc.name,
  title: doc.title,
  extension: '.md',
  documentKind: 'markdown',
  modifiedAt: 1730000000000 + idx * 60000,
}));

export const DEMO_TREE: FolderNode = {
  ...BrowserScanner.buildTree(DEMO_FILES),
  name: DEMO_WORKSPACE_NAME,
  path: DEMO_WORKSPACE_PATH,
};

export function normalizeDemoDocPath(rawPath: string | null | undefined): string {
  if (!rawPath) return 'docs/architecture-overview.md';
  const cleaned = rawPath.split('#')[0].replace(/\\/g, '/').replace(/^\/+/, '');
  const prefix = `${DEMO_WORKSPACE_PATH.replace(/^\/+/, '')}/`;
  const relative = cleaned.startsWith(prefix) ? cleaned.slice(prefix.length) : cleaned;
  if (DEMO_DOCS[relative]) return relative;
  const match = Object.keys(DEMO_DOCS).find(
    (key) => key.toLowerCase() === relative.toLowerCase() || key.endsWith(`/${relative.toLowerCase()}`),
  );
  return match ?? 'docs/architecture-overview.md';
}
