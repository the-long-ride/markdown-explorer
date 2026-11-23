import { describe, expect, it } from 'vitest';
import {
  detectMermaidDiagramKind,
  estimateGanttIntrinsicWidth,
  getMermaidLayoutConfig,
} from '../../../../ui/src/components/Content/enhancements/mermaidLayout';

describe('Mermaid diagram layout', () => {
  it.each([
    ['graph TD', 'flowchart'],
    ['SEQUENCEDIAGRAM', 'sequence'],
    ['gantt', 'gantt'],
    ['timeline', 'timeline'],
    ['gitGraph LR:', 'gitGraph'],
    ['classDiagram', 'class'],
    ['stateDiagram-v2', 'state'],
    ['architecture-beta', 'architecture'],
    ['block-beta', 'block'],
    ['C4Deployment', 'c4'],
    ['erDiagram', 'er'],
    ['mindmap', 'mindmap'],
    ['sankey-beta', 'sankey'],
    ['zenuml', 'zenuml'],
    ['packet-beta', 'packet'],
    ['kanban', 'kanban'],
    ['pie showData', 'pie'],
    ['quadrantChart', 'quadrant'],
    ['xychart-beta', 'xychart'],
    ['graphical', 'other'],
  ])('recognizes %s after BOM, frontmatter, and comments', (directive, kind) => {
    expect(detectMermaidDiagramKind(`\uFEFF\r\n --- \r\n title: example\r\n---\r\n\r\n%% comment\r\n  ${directive}`)).toBe(kind);
  });

  it.each(['', '  \n%% comment', '---\ntitle: unfinished\ngantt'])(
    'uses the default profile for a source with no declaration: %j',
    (source) => expect(getMermaidLayoutConfig(detectMermaidDiagramKind(source))).toEqual({}),
  );

  it.each([
    ['flowchart', { flowchart: { useMaxWidth: false, curve: 'linear' } }],
    ['state', { flowchart: { nodeSpacing: 36 } }],
    ['sequence', { sequence: { actorMargin: 56 } }],
    ['gantt', { gantt: { barHeight: 24 } }],
    ['gitGraph', { gitGraph: { showBranches: true, rotateCommitLabel: false } }],
    ['class', { class: { useMaxWidth: false }, flowchart: { htmlLabels: true } }],
    ['architecture', { architecture: { padding: 24 } }],
    ['block', { block: { padding: 54 } }],
    ['timeline', { timeline: { padding: 12 } }],
    ['er', { er: { diagramPadding: 12 } }],
    ['mindmap', { mindmap: { padding: 12 } }],
  ] as const)('resolves the %s spacing profile', (kind, config) => {
    expect(getMermaidLayoutConfig(kind)).toMatchObject(config);
  });

  it('sets the selected font for C4 shapes and relationships only when supplied', () => {
    expect(getMermaidLayoutConfig('c4').c4).not.toHaveProperty('messageFontFamily');
    expect(getMermaidLayoutConfig('c4', 'Monospace').c4).toMatchObject({
      personFontFamily: 'Monospace',
      external_system_dbFontFamily: 'Monospace',
      boundaryFontFamily: 'Monospace',
      messageFontFamily: 'Monospace',
      component_queueFontFamily: 'Monospace',
    });
  });

  it('ignores directives and invalid dates when sizing Gantt charts', () => {
    expect(estimateGanttIntrinsicWidth('gantt\n\n%% 2025-01-01\ntitle 2026-01-01\nsection A\nDate :2026-99-01, 30d\nDone :2026-01-01')).toBe(920);
    expect(estimateGanttIntrinsicWidth('gantt\nTask :2026-01-01, 7.5d')).toBe(1024);
    expect(estimateGanttIntrinsicWidth('gantt\nTask :2026-01-01, 600d')).toBe(3200);
    expect(estimateGanttIntrinsicWidth('gantt\nsection ' + 'W'.repeat(90))).toBe(1340);
    expect(estimateGanttIntrinsicWidth('gantt', 1020.8)).toBe(1021);
  });
});
