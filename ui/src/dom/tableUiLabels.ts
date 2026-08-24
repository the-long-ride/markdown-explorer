import type { AuditedUiTranslationDomains } from '../contexts/auditedUiTranslationTypes';

export type TableUiLabels = AuditedUiTranslationDomains['rendererUi'];

// Portable table runtimes receive the active localized labels from each rendered
// table's data-ui-labels attribute. Keep only a dependency-light English fallback
// here so export bundles never pull the complete application translation catalog.
export const DEFAULT_TABLE_UI_LABELS: TableUiLabels = {
  copy: 'Copy',
  copySectionContent: 'Copy section content',
  copied: 'Copied!',
  showMore: 'Show More',
  showLess: 'Show Less',
  filterByValues: 'Filter by values',
  searchTable: 'Search table',
  filterRows: 'Filter rows…',
  wrapTableText: 'Wrap table text',
  unwrapTableText: 'Unwrap table text',
  wrap: 'Wrap',
  unwrap: 'Unwrap',
  filterValues: 'Filter Values',
  all: '(All)',
  noValues: 'No values',
  rowsCount: '{count} rows',
  filteredRowsCount: '{matched} / {total} rows',
  columns: 'Columns',
  showAllColumns: 'Show all',
  table: 'Table',
  barChart: 'Bar Chart',
  horizontalBarChart: 'Horizontal Bar',
  lineChart: 'Line Chart',
  areaChart: 'Area Chart',
  scatterChart: 'Scatter Plot',
  radarChart: 'Radar Chart',
  polarAreaChart: 'Polar Area',
  pieChart: 'Pie Chart',
  doughnutChart: 'Doughnut Chart',
  tableViewType: 'Table view type',
  noDataForChart: 'No data to display in chart',
  series: 'Series {index}',
  chartViewTitle: 'Chart view',
  chartFit: 'Fit',
  chartZoom: 'Zoom',
  copyChartImage: 'Copy as image',
  saveChartPng: 'Save as image (.PNG)',
  closeChartView: 'Close chart view',
  chartSaveSuccess: 'Chart image saved.',
  chartSaveFailed: 'Failed to save chart image.',
  video: 'Video',
  openVideo: 'Open video',
  youtubeVideo: 'YouTube video',
  watchOnYouTube: 'Watch on YouTube',
};

export function formatUiLabel(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function getTableUiLabels(tableId: string, root: Document = document): TableUiLabels {
  const encoded = root.getElementById(`${tableId}-wrap`)?.dataset.uiLabels;
  if (!encoded) return DEFAULT_TABLE_UI_LABELS;
  try {
    return { ...DEFAULT_TABLE_UI_LABELS, ...JSON.parse(encoded) } as TableUiLabels;
  } catch {
    return DEFAULT_TABLE_UI_LABELS;
  }
}
