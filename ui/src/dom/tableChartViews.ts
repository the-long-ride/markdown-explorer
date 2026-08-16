import type { TableChartViewType } from './tableChartConfig';
import type { TableUiLabels } from './tableUiLabels';

export type ChartView = 'table' | TableChartViewType;
export type ChartLabelKey = keyof Pick<TableUiLabels,
  'table' | 'barChart' | 'horizontalBarChart' | 'lineChart' | 'areaChart' | 'scatterChart' | 'radarChart' | 'polarAreaChart' | 'pieChart' | 'doughnutChart'>;

export interface ChartViewState {
  hiddenColumnIdxs: number[];
  scatterColIdxs: number[];
  dataColIdxs: number[];
}

export const CHART_VIEWS: Array<{ id: ChartView; label: ChartLabelKey; minNumeric: number }> = [
  { id: 'table', label: 'table', minNumeric: 0 },
  { id: 'bar', label: 'barChart', minNumeric: 1 },
  { id: 'horizontalBar', label: 'horizontalBarChart', minNumeric: 1 },
  { id: 'line', label: 'lineChart', minNumeric: 1 },
  { id: 'area', label: 'areaChart', minNumeric: 1 },
  { id: 'scatter', label: 'scatterChart', minNumeric: 2 },
  { id: 'radar', label: 'radarChart', minNumeric: 1 },
  { id: 'polarArea', label: 'polarAreaChart', minNumeric: 1 },
  { id: 'pie', label: 'pieChart', minNumeric: 1 },
  { id: 'doughnut', label: 'doughnutChart', minNumeric: 1 },
];

export const MODAL_CHART_VIEWS = CHART_VIEWS.filter((item) => item.id !== 'table');

export function visibleScatterColIdxs(state: ChartViewState): number[] {
  const hidden = new Set(state.hiddenColumnIdxs);
  return state.scatterColIdxs.filter((index) => !hidden.has(index));
}

export function visibleSeriesColIdxs(state: ChartViewState): number[] {
  const hidden = new Set(state.hiddenColumnIdxs);
  return state.dataColIdxs.filter((index) => !hidden.has(index));
}

export function isViewEligible(view: string, state: ChartViewState): boolean {
  if (view === 'table') return true;
  const definition = CHART_VIEWS.find((item) => item.id === view);
  if (!definition) return false;
  const visibleNumericColumns = view === 'scatter' ? visibleScatterColIdxs(state) : visibleSeriesColIdxs(state);
  return visibleNumericColumns.length >= definition.minNumeric;
}

export function viewLabel(labels: TableUiLabels, view: string): string {
  const definition = CHART_VIEWS.find((item) => item.id === view);
  return definition ? labels[definition.label] : view;
}

export function usesItemLegend(view: string): boolean {
  return view === 'pie' || view === 'doughnut' || view === 'polarArea';
}
