export type MermaidDiagramKind =
  | 'flowchart'
  | 'sequence'
  | 'gantt'
  | 'timeline'
  | 'gitGraph'
  | 'class'
  | 'state'
  | 'architecture'
  | 'block'
  | 'c4'
  | 'er'
  | 'mindmap'
  | 'sankey'
  | 'zenuml'
  | 'other';

function firstMeaningfulLine(source: string): string {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  let checkedFrontmatter = false;
  let inFrontmatter = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!checkedFrontmatter) {
      checkedFrontmatter = true;
      if (line === '---') {
        inFrontmatter = true;
        continue;
      }
    }
    if (inFrontmatter) {
      if (line === '---') inFrontmatter = false;
      continue;
    }
    if (line.startsWith('%%')) continue;
    return line;
  }
  return '';
}

export function detectMermaidDiagramKind(source: string): MermaidDiagramKind {
  const first = firstMeaningfulLine(source);
  if (/^(?:flowchart|graph)\b/i.test(first)) return 'flowchart';
  if (/^sequenceDiagram\b/i.test(first)) return 'sequence';
  if (/^gantt\b/i.test(first)) return 'gantt';
  if (/^timeline\b/i.test(first)) return 'timeline';
  if (/^gitGraph\b/i.test(first)) return 'gitGraph';
  if (/^classDiagram\b/i.test(first)) return 'class';
  if (/^stateDiagram(?:-v2)?\b/i.test(first)) return 'state';
  if (/^architecture-beta\b/i.test(first)) return 'architecture';
  if (/^block(?:-beta)?\b/i.test(first)) return 'block';
  if (/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i.test(first)) return 'c4';
  if (/^erDiagram\b/i.test(first)) return 'er';
  if (/^mindmap\b/i.test(first)) return 'mindmap';
  if (/^sankey(?:-beta)?\b/i.test(first)) return 'sankey';
  if (/^zenuml\b/i.test(first)) return 'zenuml';
  return 'other';
}

export function getMermaidLayoutConfig(kind: MermaidDiagramKind, fontFamily?: string, _source = ''): Record<string, any> {
  const flowchart = {
    useMaxWidth: false,
    htmlLabels: true,
    nodeSpacing: 36,
    rankSpacing: 44,
    padding: 12,
    curve: 'linear',
  };

  switch (kind) {
    case 'flowchart':
    case 'state':
      return { flowchart };
    case 'sequence':
      return {
        sequence: {
          useMaxWidth: false,
          diagramMarginX: 20,
          diagramMarginY: 16,
          actorMargin: 56,
          width: 150,
          height: 54,
          boxMargin: 10,
          boxTextMargin: 6,
          noteMargin: 12,
          messageMargin: 30,
          bottomMarginAdj: 6,
        },
      };
    case 'gantt':
      return {
        gantt: {
          useMaxWidth: false,
          leftPadding: 96,
          topPadding: 44,
          gridLineStartPadding: 36,
          barHeight: 24,
          barGap: 7,
          fontSize: 13,
          sectionFontSize: 13,
          numberSectionStyles: 4,
        },
      };
    case 'gitGraph':
      return {
        gitGraph: {
          useMaxWidth: false,
          showBranches: true,
          showCommitLabel: true,
          rotateCommitLabel: false,
        },
      };
    case 'class':
      return { class: { useMaxWidth: false }, flowchart };
    case 'architecture':
      return {
        architecture: {
          useMaxWidth: false,
          padding: 24,
        },
      };
    case 'block':
      return {
        block: {
          useMaxWidth: false,
          padding: 54,
        },
      };
    case 'c4': {
      const c4: Record<string, any> = {
        useMaxWidth: false,
        diagramMarginX: 24,
        diagramMarginY: 24,
        c4ShapeMargin: 56,
        c4ShapePadding: 20,
      };
      if (fontFamily) {
        for (const field of [
          'personFontFamily', 'external_personFontFamily',
          'systemFontFamily', 'external_systemFontFamily',
          'system_dbFontFamily', 'external_system_dbFontFamily',
          'system_queueFontFamily', 'external_system_queueFontFamily',
          'boundaryFontFamily', 'messageFontFamily',
          'containerFontFamily', 'external_containerFontFamily',
          'container_dbFontFamily', 'external_container_dbFontFamily',
          'container_queueFontFamily', 'external_container_queueFontFamily',
          'componentFontFamily', 'external_componentFontFamily',
          'component_dbFontFamily', 'external_component_dbFontFamily',
          'component_queueFontFamily', 'external_component_queueFontFamily',
        ]) c4[field] = fontFamily;
      }
      return { c4 };
    }
    case 'timeline':
      return { timeline: { useMaxWidth: false, padding: 12 } };
    case 'er':
      return { er: { useMaxWidth: false, diagramPadding: 12 } };
    case 'mindmap':
      return { mindmap: { useMaxWidth: false, padding: 12 } };
    default:
      return {};
  }
}

const GANTT_MIN_INTRINSIC_WIDTH = 920;
const GANTT_MAX_INTRINSIC_WIDTH = 3200;

function parseIsoDate(value: string): number | null {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function extractGanttPressure(source: string): { longestLabel: number; taskCount: number; spanDays: number } {
  let longestLabel = 0;
  let taskCount = 0;
  const timestamps: number[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^section\s+/i.test(line)) {
      longestLabel = Math.max(longestLabel, line.replace(/^section\s+/i, '').trim().length);
      continue;
    }
    if (/^(?:gantt|title|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker)\b/i.test(line)) continue;

    const separator = line.indexOf(':');
    if (separator > 0) {
      longestLabel = Math.max(longestLabel, line.slice(0, separator).trim().length);
      taskCount += 1;
    }

    const dates = [...line.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)];
    for (const match of dates) {
      const timestamp = parseIsoDate(match[1]);
      if (timestamp !== null) timestamps.push(timestamp);
    }

    const start = dates[0] ? parseIsoDate(dates[0][1]) : null;
    const duration = line.match(/(?:^|,\s*)(\d+(?:\.\d+)?)d\b/i);
    if (start !== null && duration) {
      const durationDays = Number.parseFloat(duration[1]);
      if (Number.isFinite(durationDays)) timestamps.push(start + durationDays * dayMs);
    }
  }

  const spanDays = timestamps.length >= 2
    ? Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / dayMs))
    : 1;
  return { longestLabel, taskCount, spanDays };
}

export function estimateGanttIntrinsicWidth(source: string, renderedWidth = 0): number {
  const { longestLabel, taskCount, spanDays } = extractGanttPressure(source);
  const labelPressure = 560 + Math.min(780, longestLabel * 9);
  const taskPressure = 760 + Math.min(720, taskCount * 38);
  const timelinePressure = 640 + Math.min(spanDays, 60) * 48 + Math.max(0, spanDays - 60) * 8;
  const requested = Math.max(renderedWidth || 0, labelPressure, taskPressure, timelinePressure);
  return Math.round(Math.min(GANTT_MAX_INTRINSIC_WIDTH, Math.max(GANTT_MIN_INTRINSIC_WIDTH, requested)));
}
