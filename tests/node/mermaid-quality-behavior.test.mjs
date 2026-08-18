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
    ['packet-beta\n0-3: "Version"', 'packet'],
    ['packet\n0-3: "Version"', 'packet'],
    ['kanban\nBacklog\n[Task]', 'kanban'],
    ['pie\ntitle Share\n"A" : 1', 'pie'],
    ['quadrantChart\n  title Reach and engagement\n  x-axis Low Reach --> High Reach\n  y-axis Low Engagement --> High Engagement\n  quadrant-1 Improve Engagement\n  quadrant-2 Expand Reach\n  quadrant-3 Re-evaluate\n  quadrant-4 Maintain', 'quadrant'],
    ['xychart-beta\n  title "Sales"\n  x-axis "Month" ["Jan", "Feb", "Mar"]\n  y-axis "Revenue" 0 --> 100\n  bar [10, 40, 80]', 'xychart'],
    ['xychart\n  title "Sales"\n  x-axis "Month" ["Jan", "Feb", "Mar"]\n  y-axis "Revenue" 0 --> 100\n  bar [10, 40, 80]', 'xychart'],
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

test('Mermaid categorical palette builder mixes anchors with surface and rotates when fills exceed anchor count', async () => {
  const { buildSoftCategoricalFills } = await loadTheme();
  const tokens = {
    surface: '#191b20',
    chart1: '#ff9130', chart2: '#34d399', chart3: '#f87171',
    chart4: '#60a5fa', chart5: '#fbbf24', chart6: '#ec4899',
  };
  // Sanity: 0 / negative counts return empty.
  assert.equal(buildSoftCategoricalFills(tokens, 0).length, 0);
  assert.equal(buildSoftCategoricalFills(tokens, -1).length, 0);

  // 6 pairwise-distinct anchors yield 6 distinct soft fills.
  const fills = buildSoftCategoricalFills(tokens, 6);
  assert.equal(fills.length, 6);
  assert.equal(new Set(fills).size, 6, `expected 6 distinct soft fills; got: ${fills.join(', ')}`);

  // Mix is half-and-half: each fill must differ from surface and from every pure anchor.
  assert.ok(fills.every((f) => f !== tokens.surface));
  assert.ok(fills.every((f) => !Object.values(tokens).includes(f)));

  // Spot-check the first fill: surface rgb(25,27,32) + chart1 rgb(255,145,48) at 0.5 = rgb(140,86,40) = #8c5628.
  assert.equal(fills[0], '#8c5628');

  // Cycles past 6: index 6 wraps back to 0.
  const over = buildSoftCategoricalFills(tokens, 8);
  assert.equal(over.length, 8);
  assert.equal(over[6], over[0]);
  assert.equal(over[7], over[1]);
});

test('Mermaid categorical palette builder dedupes repeated anchor hues', async () => {
  const { buildSoftCategoricalFills } = await loadTheme();
  const tokens = {
    surface: '#191b20',
    chart1: '#ff9130', chart2: '#ff9130', chart3: '#34d399',
    chart4: '#34d399', chart5: '#60a5fa', chart6: '#60a5fa',
  };
  // 6 anchor slots collapse to 3 unique hues after dedupe; the fills rotate across those 3.
  const fills = buildSoftCategoricalFills(tokens, 6);
  assert.equal(fills.length, 6);
  assert.equal(new Set(fills).size, 3);
  assert.equal(fills[3], fills[0]);
  assert.equal(fills[4], fills[1]);
  assert.equal(fills[5], fills[2]);
});

test('Mermaid categorical fills unlock pie/quadrant/xy fills when categoricalFills is true', async () => {
  const { buildMermaidThemeVariables, buildSoftCategoricalFills } = await loadTheme();
  const tokens = {
    background: '#101114', surface: '#191b20', text: '#f5f7fa', mutedText: '#a8b0bd', border: '#434956',
    accent: '#8b5cf6', success: '#22c55e', danger: '#ef4444',
    chart1: '#ff9130', chart2: '#34d399', chart3: '#f87171', chart4: '#60a5fa',
    chart5: '#fbbf24', chart6: '#ec4899',
  };
  const soft = buildSoftCategoricalFills(tokens, 6);
  const variables = buildMermaidThemeVariables(tokens, true, { categoricalFills: true });

  assert.equal(variables.pie1, soft[0]);
  assert.equal(variables.pie2, soft[1]);
  assert.equal(variables.pie3, soft[2]);
  assert.equal(variables.pie4, soft[3]);
  assert.equal(variables.pie5, soft[4]);
  assert.equal(variables.pie6, soft[5]);

  assert.equal(variables.quadrant1Fill, soft[0]);
  assert.equal(variables.quadrant4Fill, soft[3]);

  // XY chart palette expands to 6 entries (single-token hex per fill so the comma-split parser stays well-formed).
  const xyPalette = variables.xyChart.plotColorPalette.split(',');
  assert.equal(xyPalette.length, 6);

  // Default opts: fills stay neutral and quadrant keys stay absent.
  const def = buildMermaidThemeVariables(tokens, true);
  const defPie = [def.pie1, def.pie2, def.pie3, def.pie4, def.pie5, def.pie6];
  assert.ok(defPie.every((f) => !soft.includes(f)), 'default pie fills should not be soft categorical');
  assert.equal(Object.prototype.hasOwnProperty.call(def, 'quadrant1Fill'), false, 'quadrant1Fill must not be set when categoricalFills is unset');
  assert.equal(def.xyChart.plotColorPalette.split(',').length, 3, 'default xyChart palette stays at 3 entries');
});

test('Mermaid per-kind theme options turn categorical for pie>4 sections, quadrant, and xychart', async () => {
  const { resolveMermaidThemeOptions } = await import('../../ui/src/components/Content/enhancements/mermaidRendering.ts');

  // Pie with up to 4 sections stays neutral.
  assert.deepEqual(
    resolveMermaidThemeOptions('pie', 'pie showData\n"A": 1\n"B": 2\n"C": 3\n"D": 4'),
    {},
  );

  // Pie with >4 sections flips categorical and stretches the fill count to match the slice count.
  const over = resolveMermaidThemeOptions('pie', 'pie\n"A": 1\n"B": 2\n"C": 3\n"D": 4\n"E": 5\n"F": 6');
  assert.equal(over.categoricalFills, true);
  assert.equal(over.softFillCount, 6);

  // Quadrant always categorical with 4 fills (one per quadrant).
  const quadrant = resolveMermaidThemeOptions('quadrant', 'quadrantChart\nx-axis Low Reach --> High Reach');
  assert.equal(quadrant.categoricalFills, true);
  assert.equal(quadrant.softFillCount, 4);

  // xychart gets a 6-color palette for multi-series.
  const xychart = resolveMermaidThemeOptions('xychart', 'xychart-beta\nx-axis [1,2,3]\nbar [1,2,3]');
  assert.equal(xychart.categoricalFills, true);
  assert.equal(xychart.softFillCount, 6);

  // Gantt stays neutral (the categorical palette is not applied to gantt sections).
  assert.deepEqual(resolveMermaidThemeOptions('gantt', 'gantt\nsection A\ntask1 :a, 1d\nsection B\ntask2 :b, 1d'), {});

  // Neutral kinds still get an empty options bag.
  assert.deepEqual(resolveMermaidThemeOptions('flowchart', 'flowchart TD\nA-->B'), {});
});

test('Mermaid diagram detection handles frontmatter, comments, and untagged sources', async () => {
  const { detectMermaidDiagramKind } = await loadLayout();
  assert.equal(detectMermaidDiagramKind('%% comment\nflowchart TD\nA-->B'), 'flowchart');
  assert.equal(detectMermaidDiagramKind('---\nconfig:\n  theme: dark\n---\nsequenceDiagram\nA->>B: hi'), 'sequence');
  assert.equal(detectMermaidDiagramKind('%%{init: {"theme": "base"}}%%\nkanban\nBacklog\n[Task]'), 'kanban');
  assert.equal(detectMermaidDiagramKind('zenuml\nUser->Preview: Click'), 'zenuml');
  assert.equal(detectMermaidDiagramKind('packet-beta\n0-15: "Port"'), 'packet');
  assert.equal(detectMermaidDiagramKind('architecture-beta\ngroup app(cloud)'), 'architecture');
  assert.equal(detectMermaidDiagramKind('architecture\ngroup app(cloud)'), 'architecture');
});

test('MediaGallery accurately resolves items when clicking on nested SVG elements', async () => {
  const { createMediaGallery } = await import('../../ui/src/components/Modal/mediaGallery.ts');
  const img1 = { tagName: 'IMG', currentSrc: 'img1.png', src: 'img1.png', closest: () => null };
  const svg1 = { tagName: 'svg', outerHTML: '<svg id="zen1"></svg>', getAttribute: () => null };
  const zenWrap = {
    tagName: 'DIV',
    dataset: { mdnMermaidKind: 'zenuml' },
    querySelector: (sel) => (sel === 'svg' ? svg1 : null),
    closest: (sel) => (sel.includes('mdn-mermaid-wrap') ? zenWrap : null),
    contains: (el) => el === zenWrap || el === zenText,
  };
  const zenText = {
    tagName: 'TEXT',
    closest: (sel) => (sel.includes('mdn-mermaid-wrap') ? zenWrap : null),
    contains: () => false,
  };
  const svg2 = { tagName: 'svg', outerHTML: '<svg id="kan1"></svg>', getAttribute: () => null };
  const kanWrap = {
    tagName: 'DIV',
    dataset: { mdnMermaidKind: 'kanban' },
    querySelector: (sel) => (sel === 'svg' ? svg2 : null),
    closest: (sel) => (sel.includes('mdn-mermaid-wrap') ? kanWrap : null),
    contains: (el) => el === kanWrap,
  };

  const fakeRoot = {
    querySelectorAll: () => [img1, zenWrap, kanWrap],
  };

  const gallery = createMediaGallery(zenText, fakeRoot);
  assert.ok(gallery, 'Gallery should be created');
  assert.equal(gallery.items.length, 3, 'Should find 1 image and 2 diagrams');
  assert.equal(gallery.currentIndex, 1, 'Clicking on nested text in 1st diagram should select index 1');
  assert.equal(gallery.items[1].kind, 'zenuml');
  assert.equal(gallery.items[2].kind, 'kanban');
});

