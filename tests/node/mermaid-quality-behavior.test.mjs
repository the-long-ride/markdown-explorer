import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);

async function loadTheme() {
  assert.equal(await exists('ui/src/components/Content/enhancements/mermaidTheme.ts'), true, 'mermaidTheme.ts should exist');
  return import('../../ui/src/components/Content/enhancements/mermaidTheme.ts');
}

async function loadLayout() {
  assert.equal(await exists('ui/src/components/Content/enhancements/mermaidLayout.ts'), true, 'mermaidLayout.ts should exist');
  return import('../../ui/src/components/Content/enhancements/mermaidLayout.ts');
}

test('Mermaid theme variables inherit Markdown Explorer theme colors', async () => {
  const { buildMermaidThemeVariables, mermaidContrastRatio } = await loadTheme();
  const variables = buildMermaidThemeVariables({
    background: '#101114',
    surface: '#191b20',
    text: '#f5f7fa',
    mutedText: '#a8b0bd',
    border: '#434956',
    accent: '#8b5cf6',
    success: '#22c55e',
    danger: '#ef4444',
    chart1: '#8b5cf6',
    chart2: '#14b8a6',
    chart3: '#f59e0b',
    chart4: '#3b82f6',
  }, true);

  assert.equal(variables.background, '#101114');
  assert.equal(variables.primaryColor, '#191b20');
  assert.equal(variables.primaryTextColor, '#f5f7fa');
  assert.ok(mermaidContrastRatio(variables.primaryBorderColor, variables.primaryColor) >= 3);
  assert.equal(variables.lineColor, '#8b5cf6');
  assert.equal(variables.actorBorder, '#8b5cf6');
  assert.equal(variables.doneTaskBkgColor, '#22c55e');
  assert.equal(variables.critBkgColor, '#ef4444');
});

test('Mermaid theme token reader falls back safely when CSS variables are blank', async () => {
  const { readMermaidThemeTokens } = await loadTheme();
  const style = { getPropertyValue: () => '' };
  const doc = {
    documentElement: {},
    defaultView: { getComputedStyle: () => style },
  };
  const dark = readMermaidThemeTokens(doc, true);
  const light = readMermaidThemeTokens(doc, false);
  const noDocument = readMermaidThemeTokens(undefined, true);
  assert.match(noDocument.background, /^#/);
  assert.match(dark.background, /^#/);
  assert.match(light.background, /^#/);
  assert.notEqual(dark.background, light.background);
  assert.notEqual(dark.text, light.text);
});

test('Mermaid diagram family detection covers layout-sensitive families', async () => {
  const { detectMermaidDiagramKind } = await loadLayout();
  const cases = [
    ['flowchart LR\nA-->B', 'flowchart'],
    ['---\nconfig:\n  look: handDrawn\n---\nflowchart TD\nA-->B', 'flowchart'],
    ['graph TD\nA-->B', 'flowchart'],
    ['sequenceDiagram\nA->>B: Hi', 'sequence'],
    ['gantt\ntitle Plan', 'gantt'],
    ['timeline\ntitle Events', 'timeline'],
    ['gitGraph\ncommit', 'gitGraph'],
    ['classDiagram\nA <|-- B', 'class'],
    ['stateDiagram-v2\n[*] --> A', 'state'],
    ['architecture-beta\ngroup api(cloud)[API]', 'architecture'],
    ['block-beta\ncolumns 3\na b c', 'block'],
    ['block\ncolumns 2\na b', 'block'],
    ['C4Context\ntitle System', 'c4'],
    ['erDiagram\nA ||--o{ B : has', 'er'],
    ['mindmap\n root((Root))', 'mindmap'],
    ['sankey-beta\nA,B,10', 'sankey'],
    ['zenuml\nA->B: call', 'zenuml'],
    ['pie\ntitle Share\n"A" : 1', 'other'],
  ];
  for (const [source, expected] of cases) assert.equal(detectMermaidDiagramKind(source), expected, source);
});

test('Mermaid layout profiles tune spacing without changing source direction', async () => {
  const { getMermaidLayoutConfig } = await loadLayout();
  const flow = getMermaidLayoutConfig('flowchart');
  const sequence = getMermaidLayoutConfig('sequence');
  const gantt = getMermaidLayoutConfig('gantt');
  const arch = getMermaidLayoutConfig('architecture');
  const block = getMermaidLayoutConfig('block');
  const sankey = getMermaidLayoutConfig('sankey', undefined, 'sankey-beta\nA,B,10\nA,C,10\nB,D,5\nC,D,5');
  assert.equal(flow.flowchart.nodeSpacing >= 32, true);
  assert.equal(flow.flowchart.rankSpacing >= 40, true);
  assert.equal(flow.flowchart.defaultRenderer, undefined);
  assert.equal(sequence.sequence.actorMargin >= 48, true);
  assert.equal(sequence.sequence.messageMargin >= 28, true);
  assert.equal(gantt.gantt.barHeight >= 22, true);
  assert.equal(gantt.gantt.barGap >= 6, true);
  assert.equal(arch.architecture.padding >= 24, true);
  assert.equal(block.block.padding >= 48, true);
  assert.deepEqual(sankey, {}, 'Sankey should keep Mermaid native layout and label defaults');
});

test('Mermaid foreground selection guarantees readable contrast on light and dark fills', async () => {
  const theme = await loadTheme();
  assert.equal(theme.chooseMermaidForeground('#111827', ['#111827', '#f9fafb']), '#f9fafb');
  assert.equal(theme.chooseMermaidForeground('#ffffff', ['#111827', '#f9fafb']), '#111827');
  assert.ok(theme.mermaidContrastRatio('#111827', '#f9fafb') >= 4.5);
  assert.ok(theme.mermaidContrastRatio('#ffffff', '#111827') >= 4.5);
});

test('Mermaid foreground selection handles transparent fills and keeps readable authored text', async () => {
  const theme = await loadTheme();
  assert.equal(theme.chooseMermaidForeground('transparent', ['#222222', '#f8f8f8'], { fallbackFill: '#ffffff' }), '#222222');
  assert.equal(
    theme.chooseMermaidForeground('#ffffff', ['#111827', '#f9fafb'], { currentForeground: '#111827' }),
    '#111827',
  );
  assert.equal(
    theme.chooseMermaidForeground('#111827', ['#111827', '#f9fafb'], { currentForeground: '#f9fafb' }),
    '#f9fafb',
  );
});

test('Mermaid default palette is neutral first with accent structure and semantic statuses', async () => {
  const { buildMermaidThemeVariables } = await loadTheme();
  const tokens = {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#1f2328',
    mutedText: '#667085',
    border: '#c7cbd1',
    accent: '#7c3aed',
    success: '#16a34a',
    danger: '#dc2626',
    chart1: '#7c3aed',
    chart2: '#0f9f8f',
    chart3: '#d97706',
    chart4: '#2563eb',
  };
  const variables = buildMermaidThemeVariables(tokens, false);
  assert.equal(variables.primaryColor, tokens.surface);
  assert.equal(variables.secondaryColor, tokens.surface);
  assert.equal(variables.tertiaryColor, tokens.background);
  assert.equal(variables.lineColor, tokens.accent);
  assert.equal(variables.taskBkgColor, tokens.surface);
  assert.equal(variables.activeTaskBkgColor, tokens.accent);
  assert.equal(variables.doneTaskBkgColor, tokens.success);
  assert.equal(variables.critBkgColor, tokens.danger);
  assert.equal(variables.git0, tokens.accent);
  assert.equal(variables.git1, tokens.mutedText);
});

test('adaptive Gantt width grows with labels and date span while staying bounded', async () => {
  const { estimateGanttIntrinsicWidth } = await loadLayout();
  const compact = `gantt
    title Small release
    dateFormat YYYY-MM-DD
    section Build
    Compile :2026-05-18, 2d
    Test :2026-05-20, 2d`;
  const wide = `gantt
    title Cross-region release train
    dateFormat YYYY-MM-DD
    section Preparation and validation
    Product discovery and stakeholder acceptance :done, 2026-01-03, 14d
    Multi-region integration and regression verification :active, 2026-02-15, 21d
    section Delivery
    Production rollout and rollback observation window :2026-06-20, 10d`;

  const compactWidth = estimateGanttIntrinsicWidth(compact, 700);
  const wideWidth = estimateGanttIntrinsicWidth(wide, 700);
  assert.ok(compactWidth >= 920);
  assert.ok(compactWidth <= 1600);
  assert.ok(wideWidth > compactWidth);
  assert.ok(wideWidth <= 3200);
});

test('C4 theme config uses neutral surfaces and accent structure instead of Mermaid rainbow defaults', async () => {
  const { buildMermaidC4ThemeConfig, mermaidContrastRatio } = await loadTheme();
  const tokens = {
    background: '#ffffff', surface: '#f5f5f5', text: '#111827', mutedText: '#667085', border: '#c7cbd1',
    accent: '#7c3aed', success: '#16a34a', danger: '#dc2626', chart1: '#7c3aed', chart2: '#0f9f8f',
    chart3: '#d97706', chart4: '#2563eb',
  };
  const c4 = buildMermaidC4ThemeConfig(tokens);
  assert.equal(c4.person_bg_color, tokens.surface);
  assert.equal(c4.system_bg_color, tokens.surface);
  assert.equal(c4.external_system_bg_color, tokens.background);
  assert.equal(c4.container_bg_color, tokens.surface);
  assert.equal(c4.component_bg_color, tokens.surface);
  assert.equal(c4.person_border_color, tokens.accent);
  assert.ok(mermaidContrastRatio(c4.system_border_color, c4.system_bg_color) >= 3);
});

test('Mermaid theme normalizes low-contrast custom theme structure and text colors', async () => {
  const theme = await loadTheme();
  const tokens = {
    background: '#ffffff',
    surface: '#fafafa',
    text: '#eeeeee',
    mutedText: '#ededed',
    border: '#f4f4f4',
    accent: '#f2f2f2',
    success: '#e8f5e9',
    danger: '#ffebee',
    chart1: '#f2f2f2', chart2: '#eeeeee', chart3: '#eaeaea', chart4: '#e6e6e6',
  };
  const variables = theme.buildMermaidThemeVariables(tokens, false);

  assert.ok(theme.mermaidContrastRatio(variables.primaryTextColor, variables.primaryColor) >= 4.5);
  assert.ok(theme.mermaidContrastRatio(variables.primaryBorderColor, variables.primaryColor) >= 3);
  assert.ok(theme.mermaidContrastRatio(variables.lineColor, variables.background) >= 3);
  assert.ok(theme.mermaidContrastRatio(variables.xyChart.xAxisLineColor, variables.background) >= 3);
  assert.ok(theme.mermaidContrastRatio(variables.doneTaskBorderColor, variables.background) >= 3);
  assert.ok(theme.mermaidContrastRatio(variables.critBorderColor, variables.background) >= 3);
});

test('Mermaid pie defaults stay neutral and keep section text readable', async () => {
  const theme = await loadTheme();
  const tokens = {
    background: '#101114', surface: '#191b20', text: '#f5f7fa', mutedText: '#a8b0bd', border: '#434956',
    accent: '#8b5cf6', success: '#22c55e', danger: '#ef4444', chart1: '#8b5cf6', chart2: '#14b8a6',
    chart3: '#f59e0b', chart4: '#3b82f6',
  };
  const variables = theme.buildMermaidThemeVariables(tokens, true);
  const pieColors = [variables.pie1, variables.pie2, variables.pie3, variables.pie4, variables.pie5, variables.pie6];
  const decorativeColors = new Set([tokens.accent, tokens.success, tokens.danger, tokens.chart1, tokens.chart2, tokens.chart3, tokens.chart4]);

  for (const fill of pieColors) {
    assert.equal(decorativeColors.has(fill), false, `pie fill ${fill} should be neutral by default`);
    assert.ok(theme.mermaidContrastRatio(variables.pieSectionTextColor, fill) >= 4.5, `pie text must be readable on ${fill}`);
  }
});
