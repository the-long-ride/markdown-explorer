import { usesItemLegend } from './tableChartViews';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function colorAt(value: unknown, index: number): string {
  if (Array.isArray(value)) return String(value[index] ?? value[0] ?? 'currentColor');
  return value == null ? 'currentColor' : String(value);
}

function legendButton(index: number, label: string, fill: string, stroke: string, hidden: boolean): string {
  return `<button type="button" class="mdn-chart-viewer__legend-item${hidden ? ' is-hidden' : ''}" data-chart-legend-index="${index}" aria-pressed="${hidden ? 'false' : 'true'}"><span class="mdn-chart-viewer__legend-swatch" style="--mdn-legend-fill:${escapeHtml(fill)};--mdn-legend-stroke:${escapeHtml(stroke)}" aria-hidden="true"></span><span class="mdn-chart-viewer__legend-label">${escapeHtml(label)}</span></button>`;
}

export function renderLegendItems(config: any, viewType: string, hiddenDatasets: Set<number>, hiddenItems: Set<number>): string {
  const data = config?.data ?? {};
  if (usesItemLegend(viewType)) {
    const dataset = data.datasets?.[0] ?? {};
    return (data.labels ?? []).map((label: unknown, index: number) => legendButton(
      index,
      String(label ?? ''),
      colorAt(dataset.backgroundColor, index),
      colorAt(dataset.borderColor ?? dataset.backgroundColor, index),
      hiddenItems.has(index),
    )).join('');
  }
  return (data.datasets ?? []).map((dataset: any, index: number) => legendButton(
    index,
    String(dataset?.label ?? `Series ${index + 1}`),
    colorAt(dataset?.backgroundColor, 0),
    colorAt(dataset?.borderColor ?? dataset?.backgroundColor, 0),
    hiddenDatasets.has(index),
  )).join('');
}
