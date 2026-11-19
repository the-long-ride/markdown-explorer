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

export const DEMO_HTML_PREVIEW = {
  path: 'docs/interactive-widget.html',
  title: 'Interactive Sandbox Mario Mini-Game',
  htmlContent: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Markdown Explorer HTML Sandbox — Mini Platformer</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, -apple-system, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 14px; background: #101218; color: #f4efe8; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .hud { width: 100%; max-width: 680px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .hud-stats { display: flex; gap: 14px; color: #ffd166; }
    .hud-hint { color: #9ca3af; font-weight: 500; text-transform: none; letter-spacing: 0; }
    canvas { width: 100%; max-width: 680px; height: auto; aspect-ratio: 680 / 260; border: 2px solid #2e3446; border-radius: 8px; background: #1a2642; display: block; image-rendering: pixelated; }
    .controls { width: 100%; max-width: 680px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pad { display: flex; gap: 6px; }
    button { cursor: pointer; border: 1px solid #3c4358; background: #1f2433; color: #f4efe8; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700; user-select: none; }
    button:hover { border-color: #ff9130; color: #ff9130; }
    button:active { transform: translateY(1px); }
    .btn-accent { background: #ff9130; border-color: #ff9130; color: #111; }
    .btn-accent:hover { color: #111; filter: brightness(1.08); }
  </style>
</head>
<body>
  <div class="hud">
    <div class="hud-stats">
      <span id="score">COINS: 0/5</span>
      <span id="state">READY</span>
    </div>
    <span class="hud-hint">Move: A / D or Arrows · Jump: W / Up / Space</span>
  </div>
  <canvas id="game" width="680" height="260" tabindex="0"></canvas>
  <div class="controls">
    <div class="pad">
      <button type="button" id="left">◀ Left</button>
      <button type="button" id="right">Right ▶</button>
      <button type="button" id="jump" class="btn-accent">Jump ▲</button>
    </div>
    <button type="button" id="restart">Restart</button>
  </div>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const stateEl = document.getElementById('state');
    const keys = { left: false, right: false, jump: false };

    const GROUND_Y = 216;
    const PLATFORMS = [
      { x: 130, y: 158, w: 96, h: 16, brick: true },
      { x: 270, y: 124, w: 80, h: 16, brick: true },
      { x: 390, y: 164, w: 46, h: 52, pipe: true },
      { x: 485, y: 136, w: 88, h: 16, brick: true },
    ];
    const FLAG_X = 626;

    let player, coins, enemy, status;

    function reset() {
      player = { x: 28, y: GROUND_Y - 28, w: 20, h: 28, vx: 0, vy: 0, onGround: false, facing: 1 };
      coins = [
        { x: 150, y: 132, taken: false },
        { x: 192, y: 132, taken: false },
        { x: 302, y: 96, taken: false },
        { x: 505, y: 108, taken: false },
        { x: 545, y: 108, taken: false },
      ];
      enemy = { x: 280, y: GROUND_Y - 22, w: 22, h: 22, vx: 1.35, minX: 220, maxX: 365, alive: true };
      status = 'playing';
      syncHud();
    }

    function syncHud() {
      const got = coins.filter((c) => c.taken).length;
      scoreEl.textContent = 'COINS: ' + got + '/' + coins.length;
      stateEl.textContent = status === 'won' ? 'COURSE CLEAR!' : status === 'lost' ? 'GAME OVER' : 'PLAYING';
    }

    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function update() {
      if (status !== 'playing') return;
      if (keys.left) { player.vx = -3.2; player.facing = -1; }
      else if (keys.right) { player.vx = 3.2; player.facing = 1; }
      else { player.vx *= 0.72; }

      if (keys.jump && player.onGround) {
        player.vy = -8.8;
        player.onGround = false;
      }
      player.vy = Math.min(player.vy + 0.44, 10);

      player.x = Math.max(4, Math.min(canvas.width - player.w - 4, player.x + player.vx));
      for (const p of PLATFORMS) {
        if (rectsOverlap(player, p)) {
          if (player.vx > 0) player.x = p.x - player.w;
          else if (player.vx < 0) player.x = p.x + p.w;
        }
      }

      player.y += player.vy;
      player.onGround = false;
      if (player.y + player.h >= GROUND_Y) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
      for (const p of PLATFORMS) {
        if (rectsOverlap(player, p)) {
          if (player.vy > 0) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.onGround = true;
          } else if (player.vy < 0) {
            player.y = p.y + p.h;
            player.vy = 0;
          }
        }
      }

      for (const c of coins) {
        if (!c.taken && rectsOverlap(player, { x: c.x - 8, y: c.y - 8, w: 16, h: 16 })) {
          c.taken = true;
          syncHud();
        }
      }

      if (enemy.alive) {
        enemy.x += enemy.vx;
        if (enemy.x <= enemy.minX || enemy.x + enemy.w >= enemy.maxX) enemy.vx *= -1;
        if (rectsOverlap(player, enemy)) {
          if (player.vy > 1 && player.y + player.h - player.vy <= enemy.y + 8) {
            enemy.alive = false;
            player.vy = -6.5;
          } else {
            status = 'lost';
            syncHud();
          }
        }
      }

      if (player.x + player.w >= FLAG_X) {
        status = 'won';
        syncHud();
      }
    }

    function draw() {
      // Sky + clouds
      ctx.fillStyle = '#1b2b4b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      [[75, 42, 46], [260, 34, 62], [470, 52, 54]].forEach(([cx, cy, cw]) => {
        ctx.fillRect(cx, cy, cw, 14);
        ctx.fillRect(cx + 10, cy - 8, cw - 20, 10);
      });

      // Ground
      ctx.fillStyle = '#3b2416';
      ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
      ctx.fillStyle = '#2ea043';
      ctx.fillRect(0, GROUND_Y, canvas.width, 6);

      // Platforms & pipe
      for (const p of PLATFORMS) {
        if (p.pipe) {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(p.x + 3, p.y + 10, p.w - 6, p.h - 10);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(p.x, p.y, p.w, 12);
        } else {
          ctx.fillStyle = '#c26d27';
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeStyle = '#7c3f12';
          ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
        }
      }

      // Coins
      for (const c of coins) {
        if (c.taken) continue;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.fillRect(c.x - 1, c.y - 4, 2, 8);
      }

      // Flagpole
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(FLAG_X + 6, 72, 4, GROUND_Y - 72);
      ctx.fillStyle = '#ff9130';
      ctx.fillRect(FLAG_X + 10, 74, 24, 16);

      // Enemy
      if (enemy.alive) {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(enemy.x, enemy.y + 4, enemy.w, enemy.h - 4);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(enemy.x + 4, enemy.y + 8, 4, 4);
        ctx.fillRect(enemy.x + 14, enemy.y + 8, 4, 4);
      }

      // Player (cap + overalls)
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(player.x, player.y, player.w, 7);
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(player.x + 2, player.y + 7, player.w - 4, 8);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(player.x + 1, player.y + 15, player.w - 2, 13);

      if (status !== 'playing') {
        ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = status === 'won' ? '#4ade80' : '#f87171';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(status === 'won' ? 'COURSE CLEAR!' : 'GAME OVER', canvas.width / 2, 122);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('Press Restart or Space to play again', canvas.width / 2, 150);
      }
    }

    function loop() { update(); draw(); requestAnimationFrame(loop); }

    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', ' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        if (status !== 'playing') reset();
        keys.jump = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') keys.jump = false;
    });

    const bindHold = (id, key) => {
      const btn = document.getElementById(id);
      const down = () => { keys[key] = true; };
      const up = () => { keys[key] = false; };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
    };
    bindHold('left', 'left');
    bindHold('right', 'right');
    bindHold('jump', 'jump');
    document.getElementById('restart').addEventListener('click', reset);

    reset();
    loop();
  </script>
</body>
</html>`,
} as const;

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
