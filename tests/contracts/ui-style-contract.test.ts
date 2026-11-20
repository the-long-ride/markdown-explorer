import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const uiRoot = path.join(repoRoot, 'ui/src');

function readCssFiles(...relativePaths: string[]): string {
  return relativePaths.map((relativePath) => fs.readFileSync(path.join(uiRoot, relativePath), 'utf8')).join('\n');
}

function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filePath);
    return /\.tsx?$/.test(entry.name) ? [filePath] : [];
  });
}

type StyleViolation = {
  file: string;
  line: number;
  rule: string;
  excerpt: string;
};

function findStyleViolations(filePath: string): StyleViolation[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const file = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  const violations: StyleViolation[] = [];
  const addMatches = (pattern: RegExp, rule: string) => {
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      violations.push({
        file,
        line: source.slice(0, index).split('\n').length,
        rule,
        excerpt: source.slice(index, index + 100).split('\n')[0].trim(),
      });
    }
  };

  // JSX style props make presentation unavailable to shared stylesheets.
  if (/\.tsx$/.test(filePath)) {
    addMatches(/\bstyle\s*=\s*(?:\{\{|\{|['"])/g, 'JSX style prop');
  }
  // The old helper writes arbitrary CSS directly to DOM nodes. CSS variables
  // remain allowed through useCssVars because they carry runtime values only.
  addMatches(/\buseDomStyles\b/g, 'useDomStyles runtime inline CSS');

  return violations;
}

describe('UI style contract', () => {
  test('uses near-opaque Aurora Glass tooltip and dropdown surfaces', () => {
    const tooltipCss = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-switch-tooltip-diff.css'),
      'utf8',
    );
    const menuCss = readCssFiles(
      'styles/global/global-topbar-actions.css',
      'styles/global/global-workspace-tabs.css',
      'styles/global/global-tab-actions-menus.css',
    );
    expect(tooltipCss).toMatch(/background:\s*rgb\(22 24 31\);/);
    expect(tooltipCss).toMatch(/background:\s*rgb\(250 250 252\);/);
    expect(tooltipCss).toMatch(
      /\[data-theme-style="glass"\] \.tooltip-container:hover \.tooltip-text\s*\{[^}]*opacity:\s*1;/s,
    );
    expect(menuCss).toMatch(/background:\s*rgb\(22 24 31\);/);
    expect(menuCss).toMatch(/background:\s*rgb\(250 250 252\);/);
  });


  test('registers Neon Voltage and Raw Grid with auto-light tokens and header parity', () => {
    const globalCss = fs.readFileSync(path.join(uiRoot, 'styles/global.css'), 'utf8');
    const themeTokens = readCssFiles(
      'styles/tokens/tokens-style-foundation.css',
      'styles/tokens/tokens-style-vivid.css',
    );
    const autoLightTokens = fs.readFileSync(
      path.join(uiRoot, 'styles/tokens/tokens-pet-auto-light.css'),
      'utf8',
    );
    const themeFiles = [
      'global-theme-glass-bento.css',
      'global-theme-vercel.css',
      'global-theme-tokyo-night.css',
    ].map((file) => fs.readFileSync(path.join(uiRoot, 'styles/global', file), 'utf8'));
    const tokyo = themeFiles[2];

    expect(globalCss).toContain('global-theme-neon-voltage.css');
    expect(globalCss).toContain('global-theme-raw-grid.css');
    expect(globalCss).toContain('global-theme-cyberpunk.css');
    for (const id of ['neon-voltage', 'raw-grid', 'cyberpunk']) {
      expect(themeTokens).toContain(`[data-theme-style="${id}"][data-theme="dark"]`);
      expect(themeTokens).toContain(`[data-theme-style="${id}"][data-theme="light"]`);
      expect(autoLightTokens).toContain(`[data-theme-style="${id}"][data-theme="auto"]`);
    }
    for (const css of themeFiles) expect(css).toContain('.app--tab-view .desktop-tabbar');
    expect(tokyo).toContain('--theme-header-gap: 8px');
    expect(tokyo).toMatch(/\.sidebar,[\s\S]*\.toc-panel\s*\{[^}]*margin-top:\s*var\(--theme-header-gap\)/);
  });

  test('uses primary theme text for keyboard shortcut names', () => {
    const layoutCss = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-settings-layout.css'),
      'utf8',
    );
    const responsiveCss = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-settings-responsive.css'),
      'utf8',
    );
    const layoutBlock = layoutCss.match(/\.settings-shortcut-label\s*\{([^}]*)\}/s)?.[1] ?? '';
    const responsiveBlock = responsiveCss.match(/\.settings-shortcut-label\s*\{([^}]*)\}/s)?.[1] ?? '';

    expect(layoutBlock).toMatch(/color:\s*var\(--tx\);/);
    expect(responsiveBlock).toMatch(/color:\s*var\(--tx\)\s*!important;/);
  });

  test('does not underline the workspace Show More button', () => {
    const css = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-workspace-selection-screen.css'),
      'utf8',
    );
    const block = css.match(/\.workspace-selection__show-more\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(block).toContain('text-decoration: none;');
    expect(block).not.toContain('text-underline-offset');
  });

  test('keeps both workspace tab close animation phases under 200ms', () => {
    const css = readCssFiles(
      'styles/global/global-topbar-actions.css',
      'styles/global/global-workspace-tabs.css',
      'styles/global/global-tab-actions-menus.css',
    );
    const fadeBlock = css.match(/\.desktop-tab\.is-closing--fade\s*\{([^}]*)\}/s)?.[1] ?? '';
    const collapseBlock = [...css.matchAll(/\.desktop-tab\.is-closing--collapse\s*\{([^}]*)\}/gs)]
      .map((match) => match[1])
      .find((block) => block.includes('width: 0;')) ?? '';

    expect(fadeBlock).toContain('opacity: 0;');
    expect(fadeBlock).toContain('opacity 90ms ease');
    expect(collapseBlock).toContain('width: 0;');
    expect(collapseBlock).toContain('width 140ms ease');

    const durations = [...fadeBlock.matchAll(/(\d+)ms/g), ...collapseBlock.matchAll(/(\d+)ms/g)]
      .map((match) => Number(match[1]));
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.every((duration) => duration <= 200)).toBe(true);
  });

  test('keeps both document tab close animation phases under 200ms', () => {
    const css = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-content-tabs-focus-search.css'),
      'utf8',
    );
    const fadeBlock = css.match(/\.content-tab\.is-closing--fade\s*\{([^}]*)\}/s)?.[1] ?? '';
    const collapseBlock = [...css.matchAll(/\.content-tab\.is-closing--collapse\s*\{([^}]*)\}/gs)]
      .map((match) => match[1])
      .find((block) => block.includes('width: 0;')) ?? '';
    expect(fadeBlock).toContain('opacity 90ms ease');
    expect(collapseBlock).toContain('width 140ms ease');
    expect(css).toMatch(/\.content-tab\.is-active\.is-closing--collapse\s*\{[^}]*flex-basis:\s*0;/s);
    const durations = [...fadeBlock.matchAll(/(\d+)ms/g), ...collapseBlock.matchAll(/(\d+)ms/g)]
      .map((match) => Number(match[1]));
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.every((duration) => duration <= 200)).toBe(true);
  });

  test('removes the Properties accent rail', () => {
    const css = readCssFiles(
      'styles/global/global-markdown-foundation.css',
      'styles/global/global-markdown-structures.css',
    );
    const block = css.match(/\.mdn-frontmatter\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(block).not.toMatch(/border-left\s*:/);
  });

  test('does not use JSX inline style props', () => {
    const violations = collectSourceFiles(uiRoot).flatMap(findStyleViolations);

    expect(
      violations,
      violations.length
        ? `Inline CSS violations:\n${violations
            .map(({ file, line, rule, excerpt }) => `${file}:${line} (${rule}) ${excerpt}`)
            .join('\n')}`
        : undefined,
    ).toEqual([]);
  });

  test('uses standard design tokens and theme styles for workspace insights and wiki elements', () => {
    const insightsCss = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-workspace-insights.css'),
      'utf8',
    );
    const structuresCss = fs.readFileSync(
      path.join(uiRoot, 'styles/global/global-markdown-structures.css'),
      'utf8',
    );
    const globalCss = fs.readFileSync(path.join(uiRoot, 'styles/global.css'), 'utf8');

    expect(globalCss).toContain('global-workspace-insights.css');
    expect(insightsCss).not.toMatch(/var\(--(?:border|text|text-muted|hover|elevated|bg-surface)\b/);
    expect(insightsCss).toContain('var(--tx)');
    expect(insightsCss).toContain('var(--tx2)');
    expect(insightsCss).toContain('var(--bg)');
    expect(insightsCss).toContain('var(--bd-s)');

    expect(structuresCss).toContain('.mdn-wiki-link');
    expect(structuresCss).toContain('.mdn-wiki-embed');
    expect(structuresCss).toContain('.mdn-wiki-embed-placeholder');
    expect(structuresCss).toContain('var(--accent-text)');

    for (const file of [
      'global-theme-glass-bento.css',
      'global-theme-tokyo-night.css',
      'global-theme-neon-voltage.css',
      'global-theme-raw-grid.css',
      'global-theme-cyberpunk.css',
      'global-theme-vercel.css',
    ]) {
      const content = fs.readFileSync(path.join(uiRoot, 'styles/global', file), 'utf8');
      expect(content).toContain('.workspace-insights');
    }
  });

  test('enforces theme-adaptive border-radius and shape on badges, tags, and tour indicators', () => {
    const baseTokens = fs.readFileSync(path.join(uiRoot, 'styles/tokens/tokens-base-themes.css'), 'utf8');
    const vividTokens = fs.readFileSync(path.join(uiRoot, 'styles/tokens/tokens-style-vivid.css'), 'utf8');

    expect(baseTokens).toMatch(/--r-sm:\s*4px;/);
    expect(vividTokens).toMatch(/\[data-theme-style="raw-grid"\]\s*\{[^}]*--r-sm:\s*0px;/s);
    expect(vividTokens).toMatch(/\[data-theme-style="cyberpunk"\]\s*\{[^}]*--r-sm:\s*0px;/s);

    const badgeCss = [
      fs.readFileSync(path.join(uiRoot, 'components/Content/WelcomeCommandDeck.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'components/Content/WelcomePageOverview.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'components/Content/WelcomePageSupport.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'components/Tour/TourGuideOverlay.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'styles/global/global-file-history-modal.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'styles/global/global-history-diff.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'styles/global/global-settings-typography.css'), 'utf8'),
      fs.readFileSync(path.join(uiRoot, 'styles/global/global-content-tabs-focus-search.css'), 'utf8'),
    ].join('\n');

    const selectors = [
      '.welcome-tour-trigger-btn__badge',
      '.tour-guide-badge',
      '.tour-guide-dot',
      '.tip-card-badge',
      '.hero-star-banner__count',
      '.welcome-ecosystem__count',
      '.welcome-ecosystem__item-tag',
      '.file-history__badge',
      '.repository-history__head-badge',
      '.desktop-font-card__badge',
      '.tree-file-search-count-badge',
    ];

    for (const sel of selectors) {
      const escaped = sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm');
      const match = badgeCss.match(regex);
      expect(match, `Expected rule for ${sel}`).toBeTruthy();
      const block = match?.[1] ?? '';
      expect(block).toContain('var(--r-sm');
      expect(block).not.toContain('border-radius: 999px');
      expect(block).not.toContain('border-radius: 12px');
    }

    const commandDeckCss = fs.readFileSync(path.join(uiRoot, 'components/Content/WelcomeCommandDeck.css'), 'utf8');
    const tourOverlayCss = fs.readFileSync(path.join(uiRoot, 'components/Tour/TourGuideOverlay.css'), 'utf8');

    const cyberpunkDeckSelectors = [
      '.welcome-tour-trigger-btn__badge',
      '.welcome-ecosystem__count',
      '.welcome-ecosystem__item-tag',
      '.hero-star-banner__count',
    ];
    for (const sel of cyberpunkDeckSelectors) {
      const escaped = sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      expect(commandDeckCss).toMatch(
        new RegExp(`:root\\[data-theme\\]\\[data-theme-style="cyberpunk"\\][\\s\\S]*?${escaped}[\\s\\S]*?clip-path`),
      );
    }

    const cyberpunkTourSelectors = [
      '.tour-guide-badge',
      '.tour-guide-dot',
    ];
    for (const sel of cyberpunkTourSelectors) {
      const escaped = sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      expect(tourOverlayCss).toMatch(
        new RegExp(`:root\\[data-theme\\]\\[data-theme-style="cyberpunk"\\][\\s\\S]*?${escaped}[\\s\\S]*?clip-path`),
      );
    }

    const overviewCss = fs.readFileSync(path.join(uiRoot, 'components/Content/WelcomePageOverview.css'), 'utf8');
    expect(overviewCss).toMatch(/:is\(\.tabs-bar,\s*\.welcome-tabs\)[\s\S]*?border-radius:\s*var\(--r-lg/);
    expect(overviewCss).not.toMatch(/:is\(\.tabs-bar,\s*\.welcome-tabs\)[\s\S]*?border-radius:\s*(?:30px|999px|9999px)/);
    expect(overviewCss).toMatch(/:is\(\.tab-btn,\s*\.welcome-tab\)[\s\S]*?border-radius:\s*var\(--r-md/);
    expect(overviewCss).not.toMatch(/:is\(\.tab-btn,\s*\.welcome-tab\)[\s\S]*?border-radius:\s*(?:25px|999px|9999px)/);
    expect(commandDeckCss).toMatch(/:is\(\.tabs-bar,\s*\.welcome-tabs\)[\s\S]*?border-radius:\s*var\(--r-lg/);
    expect(commandDeckCss).toMatch(/:is\(\.tab-btn,\s*\.welcome-tab\)[\s\S]*?border-radius:\s*var\(--r-md/);
  });

  test('enforces view transition feathered gradient masks and multi-zone curtains without circle clip-paths', () => {
    const vtCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-view-transitions.css'), 'utf8');

    // 1. Top-to-bottom to-dark feathered gradient mask
    expect(vtCss).toMatch(
      /:root\[data-transition-direction="to-dark"\]::view-transition-new\(root\)[\s\S]*?-webkit-mask-image:\s*linear-gradient\(180deg,[\s\S]*?mask-size:\s*100%\s+260%/
    );
    expect(vtCss).toMatch(
      /:root\[data-transition-direction="to-dark"\][\s\S]*?::view-transition-new\(root\)[\s\S]*?animation:\s*vt-mask-sweep-down/
    );

    // 2. Bottom-to-top to-light reverse feathered gradient mask
    expect(vtCss).toMatch(
      /:root\[data-transition-direction="to-light"\]::view-transition-new\(root\)[\s\S]*?-webkit-mask-image:\s*linear-gradient\(0deg,[\s\S]*?mask-size:\s*100%\s+260%/
    );
    expect(vtCss).toMatch(
      /:root\[data-transition-direction="to-light"\][\s\S]*?::view-transition-new\(root\)[\s\S]*?animation:\s*vt-mask-sweep-up/
    );

    // 3. Multi-zone gradient curtain across theme presets (default, raw-grid, bento, pet-*, neon-voltage, tokyo-night, vercel)
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-direction="to-dark"\] \.theme-magic-overlay__beam[\s\S]*?linear-gradient\(180deg,\s*transparent\s*0%,\s*rgba\(30,\s*27,\s*75/
    );
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-direction="to-light"\] \.theme-magic-overlay__beam[\s\S]*?linear-gradient\(0deg,\s*transparent\s*0%,\s*rgba\(254,\s*243,\s*199/
    );
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-theme-style="neon-voltage"\]\[data-direction="to-dark"\] \.theme-magic-overlay__beam[\s\S]*?rgba\(255,\s*0,\s*127/
    );
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-theme-style="tokyo-night"\]\[data-direction="to-dark"\] \.theme-magic-overlay__beam[\s\S]*?rgba\(122,\s*162,\s*247/
    );
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-theme-style="vercel"\]\[data-direction="to-dark"\] \.theme-magic-overlay__beam[\s\S]*?rgba\(161,\s*161,\s*170/
    );

    // 4. Smooth reduced-size cyberpunk glitch slabs
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-theme-style="cyberpunk"\] \.theme-magic-overlay__beam[\s\S]*?background-size:\s*100%\s+4\.5%,\s*100%\s+5\.5%,\s*100%\s+4%;/
    );
    expect(vtCss).toMatch(
      /\.theme-magic-overlay\[data-theme-style="cyberpunk"\] \.theme-magic-overlay__beam[\s\S]*?background-position:\s*0\s+26%,\s*0\s+52%,\s*0\s+74%;/
    );

    // 5. Zero circle(...) clip-paths in view transition styles
    expect(vtCss).not.toContain('circle(');
  });

  test('enforces cyberpunk chamfered polygon shapes on TOC items and hides marker dots', () => {
    const cpSurfacesCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-theme-cyberpunk-surfaces.css'), 'utf8');

    // Chamfered polygon on .toc-item and .toc-link
    expect(cpSurfacesCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\]\s*:is\(\.toc-item,\s*\.toc-link\)[\s\S]*?clip-path:\s*polygon\(0\s+0,\s*calc\(100%\s*-\s*var\(--cp-cut-top,\s*7px\)\)\s+0,\s*100%\s+var\(--cp-cut-top,\s*7px\),\s*100%\s+100%,\s*var\(--cp-cut-bottom,\s*6px\)\s+100%,\s*0\s+calc\(100%\s*-\s*var\(--cp-cut-bottom,\s*6px\)\)\)\s*!important;/
    );
    expect(cpSurfacesCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\]\s*:is\(\.toc-item,\s*\.toc-link\)[\s\S]*?border-radius:\s*0\s*!important;/
    );

    // .toc-item__marker and ::before dot hidden in Cyberpunk theme
    expect(cpSurfacesCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\]\s*:is\(\.toc-item,\s*\.toc-link\)\s+\.toc-item__marker,\s*:root\[data-theme\]\[data-theme-style="cyberpunk"\]\s*:is\(\.toc-item,\s*\.toc-link\)::before\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?content:\s*none\s*!important;/
    );
  });

  test('enforces theme toggle morph styling with currentColor and zero color filters', () => {
    const themePickerCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-theme-picker-settings.css'), 'utf8');

    expect(themePickerCss).toMatch(
      /\.theme-toggle-morph\s*\{[\s\S]*?color:\s*currentColor;[\s\S]*?filter:\s*none;/
    );
    expect(themePickerCss).toMatch(
      /\[data-theme="dark"\]\s+\.theme-toggle-morph\s*\{[\s\S]*?filter:\s*none;/
    );
    expect(themePickerCss).toMatch(
      /\[data-theme="light"\]\s+\.theme-toggle-morph\s*\{[\s\S]*?filter:\s*none;/
    );
    expect(themePickerCss).toMatch(
      /\.theme-toggle-morph\s+svg\s*\{[\s\S]*?color:\s*currentColor;[\s\S]*?filter:\s*none;/
    );
    expect(themePickerCss).not.toMatch(/\.theme-toggle-morph[^{]*\{[^}]*filter:\s*drop-shadow/);
  });

  test('enforces shell control sizing parity for close-workspace button and mode switchers', () => {
    const shellSizingCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-shell-control-sizing.css'), 'utf8');

    // 28x28 square sizing for close-workspace-btn
    expect(shellSizingCss).toMatch(/--shell-action-size:\s*28px;/);
    expect(shellSizingCss).toMatch(
      /:is\([^)]*\.topbar__close-workspace-btn[^)]*\)\s*\{[\s\S]*?width:\s*var\(--shell-action-size\)\s*!important;[\s\S]*?height:\s*var\(--shell-action-size\)\s*!important;/
    );

    // 28px height alignment for topbar__markdown-editing and split-document-pane__modes
    expect(shellSizingCss).toMatch(
      /:is\(\.topbar__markdown-editing,\s*\.split-document-pane__modes\)\s*\{[\s\S]*?height:\s*var\(--shell-action-size,\s*28px\)\s*!important;[\s\S]*?min-height:\s*var\(--shell-action-size,\s*28px\)\s*!important;[\s\S]*?max-height:\s*var\(--shell-action-size,\s*28px\)\s*!important;/
    );
  });

  test('keeps markdown editor gutters and scrollers synchronized with dynamic font size', () => {
    const editingCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-markdown-editing.css'), 'utf8');
    const tablesCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-document-sections-tables.css'), 'utf8');

    // Scroller font size must read from --editor-font-size
    expect(editingCss).toMatch(/\.markdown-source-editor__host \.cm-scroller\s*\{[^}]*font-size:\s*var\(--editor-font-size/);
    expect(editingCss).toMatch(/\.markdown-source-editor__host \.cm-line\s*\{[^}]*line-height:\s*inherit;/);

    // Gutter elements must never hardcode 12px; must inherit font-size and line-height
    expect(editingCss).not.toMatch(/\.markdown-source-editor__host \.cm-lineNumbers \.cm-gutterElement\s*\{[^}]*font-size:\s*12px/);
    expect(editingCss).toMatch(/\.markdown-source-editor__host \.cm-lineNumbers \.cm-gutterElement\s*\{[^}]*font-size:\s*inherit;/);
    expect(editingCss).toMatch(/\.markdown-source-editor__host \.cm-lineNumbers \.cm-gutterElement\s*\{[^}]*line-height:\s*inherit;/);

    // Inline editor source and table editor scroller must both bind to --editor-font-size
    expect(editingCss).toMatch(/\.markdown-inline-editor__source\s*\{[^}]*font-size:\s*var\(--editor-font-size/);
    expect(tablesCss).toMatch(/\.markdown-inline-editor__table-host \.cm-scroller\s*\{[^}]*font-size:\s*var\(--editor-font-size/);
  });

  test('does not attach native HTML title attributes to non-iframe elements in UI components and markdown renderers', () => {
    const targetFiles = [
      ...collectSourceFiles(path.join(uiRoot, 'components')).filter((file) => /\.tsx$/.test(file)),
      path.join(uiRoot, 'markdown/utils.ts'),
      path.join(uiRoot, 'markdown/tableRenderer.ts'),
    ];
    const violations = targetFiles.flatMap(findNativeTitleViolations);

    expect(
      violations,
      violations.length
        ? `Native HTML title attribute violations:\n${violations
            .map(({ file, line, excerpt }) => `${file}:${line}: ${excerpt}`)
            .join('\n')}`
        : undefined,
    ).toEqual([]);
  });

  test('enforces visible inline edit zone outline, inset perimeter, and hover styling in Cyberpunk theme', () => {
    const cpCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-theme-cyberpunk.css'), 'utf8');
    const editingCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-markdown-editing.css'), 'utf8');

    expect(cpCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\][\s\S]*?\.is-inline-editable:hover\s*\{[^}]*outline:\s*1px\s+dashed\s+var\(--accent\)\s*!important;/
    );
    expect(cpCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\][\s\S]*?\.is-inline-editable:hover\s*\{[^}]*box-shadow:\s*inset\s+0\s+0\s+0\s+1px/
    );
    expect(cpCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\][\s\S]*?\.mdn-heading-text\.is-inline-editable/
    );
    expect(cpCss).toMatch(
      /:root\[data-theme\]\[data-theme-style="cyberpunk"\] :is\(\*:not\(\.is-inline-editable\)/
    );
    expect(editingCss).toMatch(/\.mdn-body \.is-inline-editable:hover\s*\{[^}]*background-color:/);
  });

  test('applies Cyberpunk chamfer geometry and hover edges to content right-click menus', () => {
    const globalCss = fs.readFileSync(path.join(uiRoot, 'styles/global.css'), 'utf8');
    const menusCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-theme-cyberpunk-menus.css'), 'utf8');

    expect(globalCss).toContain("global-theme-cyberpunk-menus.css");
    expect(menusCss).toMatch(/:root\[data-theme\]\[data-theme-style="cyberpunk"\] \.mdn-link-context-menu\s*\{[\s\S]*?clip-path:\s*polygon\(/);
    expect(menusCss).toMatch(/:root\[data-theme\]\[data-theme-style="cyberpunk"\] \.mdn-link-context-menu button\s*\{[\s\S]*?clip-path:\s*polygon\(/);
    expect(menusCss).toMatch(/:root\[data-theme\]\[data-theme-style="cyberpunk"\] \.mdn-link-context-menu button:is\(:hover, :focus-visible\):not\(:disabled\)/);
  });

  test('disables horizontal scrollbars on document body scrollers including split view and constrains body blocks', () => {
    const contentTabsCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-content-tabs-focus-search.css'), 'utf8');
    const splitCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-split-document-view.css'), 'utf8');
    const scopeCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-scope-view.css'), 'utf8');
    const markdownFoundationCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-markdown-foundation.css'), 'utf8');
    const switchCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-switch-tooltip-diff.css'), 'utf8');

    expect(contentTabsCss).toMatch(/\.content__scroll\s*\{[^}]*overflow-x:\s*hidden;/s);
    expect(splitCss).toMatch(/\.split-document-pane__scroll\s*\{[^}]*overflow-x:\s*hidden;/s);
    expect(scopeCss).toMatch(/\.scope-view__scroll\s*\{[^}]*overflow-x:\s*hidden;/s);
    expect(markdownFoundationCss).toMatch(/\.mdn-body\s*\{[^}]*max-width:\s*100%;/s);
    expect(markdownFoundationCss).toMatch(/\.mdn-body\s*\{[^}]*overflow-wrap:\s*break-word;/s);
    expect(switchCss).toMatch(/^\.mdn-body \.mermaid svg\s*\{/m);
  });

  test('keeps Scope View below active body overlays, MediaModal, and dropdowns', () => {
    const scopeCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-scope-view.css'), 'utf8');
    const syntaxCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-code-syntax.css'), 'utf8');
    const tableCoreCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-sections-table-core.css'), 'utf8');
    const mediaCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-media-viewer-settings-shell.css'), 'utf8');
    const tableControlsCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-table-view-controls.css'), 'utf8');

    expect(scopeCss).toMatch(/\.scope-view\s*\{[^}]*z-index:\s*var\(--z-modal\);/s);
    expect(mediaCss).toMatch(/\.media-modal\.mdn-modal\s*\{[^}]*z-index:\s*var\(--z-modal-popover\);/s);
    expect(syntaxCss).toMatch(/body\s*>\s*\.mdn-link-context-menu\s*\{[^}]*z-index:/s);
    expect(syntaxCss).toMatch(/\.mdn-action-notice\s*\{[^}]*z-index:\s*calc\(var\(--z-tooltip\) - 1\);/s);
    const contentTsx = fs.readFileSync(path.join(uiRoot, 'components/Content/Content.tsx'), 'utf8');
    expect(contentTsx).toContain('createPortal(actionNoticeNode, document.body)');
    expect(tableCoreCss).not.toMatch(/\.mdn-filter-dropdown\s*\{[^}]*z-index:\s*var\(--z-dropdown\);/s);
    expect(tableControlsCss).not.toMatch(/not\(\.is-wrapped\)\s+\.mdn-table\s+th\s*\{[^}]*overflow:\s*hidden/s);
  });

  test('keeps context menu item shortcut keycaps compact so row height stays uniform', () => {
    const menusCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-tab-actions-menus.css'), 'utf8');
    const cpMenusCss = fs.readFileSync(path.join(uiRoot, 'styles/global/global-theme-cyberpunk-menus.css'), 'utf8');

    expect(menusCss).toMatch(/\.tab-context-menu__item-shortcut\s*\{[^}]*height:\s*16px;/s);
    expect(cpMenusCss).toMatch(/\.tab-context-menu__item-shortcut\s*\{[^}]*height:\s*16px;/s);
  });
});

type TitleViolation = {
  file: string;
  line: number;
  excerpt: string;
};

function findNativeTitleViolations(filePath: string): TitleViolation[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const file = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  const violations: TitleViolation[] = [];
  const tagStartRegex = /<([a-z][a-z0-9-]*)\b/g;
  let match: RegExpExecArray | null;

  while ((match = tagStartRegex.exec(source)) !== null) {
    const tagName = match[1];
    if (tagName === 'iframe') continue;
    const startIndex = match.index;
    let i = startIndex + match[0].length;
    let braceDepth = 0;
    let quote: string | null = null;

    while (i < source.length) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '{') {
        braceDepth++;
      } else if (ch === '}') {
        if (braceDepth > 0) braceDepth--;
      } else if (braceDepth === 0) {
        if (ch === '>' || (ch === '/' && source[i + 1] === '>')) break;
        if (ch === '<') break;
      }
      i++;
    }

    const tagAttrs = source.slice(startIndex, i);
    const titleMatch = /(?<!-)\btitle\s*=/i.exec(tagAttrs);
    if (titleMatch) {
      const titleIndex = startIndex + titleMatch.index;
      violations.push({
        file,
        line: source.slice(0, titleIndex).split('\n').length,
        excerpt: source.slice(titleIndex, titleIndex + 80).split('\n')[0].trim(),
      });
    }
  }

  return violations;
}

export { findStyleViolations, findNativeTitleViolations };
