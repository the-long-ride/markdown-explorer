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
    for (const id of ['neon-voltage', 'raw-grid']) {
      expect(themeTokens).toContain(`[data-theme-style="${id}"][data-theme="dark"]`);
      expect(themeTokens).toContain(`[data-theme-style="${id}"][data-theme="light"]`);
      expect(autoLightTokens).toContain(`[data-theme-style="${id}"][data-theme="auto"]`);
    }
    for (const css of themeFiles) expect(css).toContain('.app--tab-view .desktop-tabbar');
    expect(tokyo).toContain('--theme-header-gap: 8px');
    expect(tokyo).toMatch(/\.sidebar,[\s\S]*\.toc-panel\s*\{[^}]*margin-top:\s*var\(--theme-header-gap\)/);
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
});

export { findStyleViolations };
