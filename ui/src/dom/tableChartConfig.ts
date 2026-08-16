import { formatUiLabel, getTableUiLabels } from './tableUiLabels';

export type TableChartViewType = 'bar' | 'horizontalBar' | 'line' | 'area' | 'scatter' | 'radar' | 'polarArea' | 'pie' | 'doughnut';

export interface TableChartConfigInput {
  tableId: string;
  viewType: TableChartViewType;
  table: HTMLTableElement;
  chartRows: HTMLTableRowElement[];
  labelColIdx: number;
  visibleColumns: number[];
  getChartColors: (count: number) => string[];
}

function parseNumericCell(text: string): number {
  const clean = text.replace(/[\$,%]/g, '').trim();
  const parsed = Number.parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function truncateChartLabel(text: string, maxLength = 25): string {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
}

export function buildTableChartConfig({
  tableId,
  viewType,
  table,
  chartRows,
  labelColIdx,
  visibleColumns,
  getChartColors,
}: TableChartConfigInput): any {
  const labels = chartRows.map((row) => truncateChartLabel(row.cells[labelColIdx]?.textContent?.trim() ?? ''));
  const styles = getComputedStyle(document.documentElement);
  const colors = getChartColors(Math.max(visibleColumns.length, chartRows.length));
  const uiLabels = getTableUiLabels(tableId);
  const headers = table.querySelectorAll('thead th');
  const headerFor = (colIdx: number, index: number) => headers[colIdx]?.querySelector('.mdn-th-text')?.textContent?.trim()
    ?? formatUiLabel(uiLabels.series, { index: index + 1 });

  let datasets: any[];
  if (viewType === 'scatter') {
    const xColIdx = visibleColumns[0];
    datasets = visibleColumns.slice(1).map((yColIdx, datasetIndex) => ({
      label: headerFor(yColIdx, datasetIndex),
      data: chartRows.map((row) => ({
        x: parseNumericCell(row.cells[xColIdx]?.textContent?.trim() ?? '0'),
        y: parseNumericCell(row.cells[yColIdx]?.textContent?.trim() ?? '0'),
      })),
      backgroundColor: colors[datasetIndex] + '88',
      borderColor: colors[datasetIndex],
      borderWidth: 2,
    }));
  } else {
    datasets = visibleColumns.map((colIdx, datasetIndex) => {
      const data = chartRows.map((row) => parseNumericCell(row.cells[colIdx]?.textContent?.trim() ?? '0'));
      const color = colors[datasetIndex];
      if (viewType === 'pie' || viewType === 'doughnut' || viewType === 'polarArea') {
        const sliceColors = getChartColors(data.length);
        return {
          label: headerFor(colIdx, datasetIndex),
          data,
          backgroundColor: sliceColors.map((item: string) => item + 'cc'),
          borderColor: sliceColors,
          borderWidth: 1,
        };
      }
      return {
        label: headerFor(colIdx, datasetIndex),
        data,
        backgroundColor: color + (viewType === 'area' || viewType === 'radar' ? '33' : '55'),
        borderColor: color,
        borderWidth: 2,
        tension: viewType === 'line' || viewType === 'area' ? 0.2 : undefined,
        fill: viewType === 'area',
      };
    });
  }

  if (viewType === 'pie' || viewType === 'doughnut' || viewType === 'polarArea') datasets = datasets.slice(0, 1);

  const chartType = viewType === 'horizontalBar' ? 'bar'
    : viewType === 'area' ? 'line'
      : viewType === 'pie' ? 'pie'
        : viewType === 'doughnut' ? 'doughnut'
          : viewType;
  const textColor = styles.getPropertyValue('--tx2').trim() || '#9191a4';
  const gridColor = styles.getPropertyValue('--bd').trim() || 'rgba(255,255,255,0.07)';
  const isCircular = viewType === 'pie' || viewType === 'doughnut' || viewType === 'polarArea';
  const isRadar = viewType === 'radar';

  return {
    type: chartType,
    data: { labels: viewType === 'scatter' ? undefined : labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      indexAxis: viewType === 'horizontalBar' ? 'y' : 'x',
      elements: (viewType === 'line' || viewType === 'area') && chartRows.length > 200
        ? { point: { radius: 0, hoverRadius: 3 } }
        : undefined,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: textColor, font: { family: 'var(--font-ui)' } } },
      },
      scales: isCircular ? undefined : isRadar ? {
        r: {
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          ticks: { color: textColor, backdropColor: 'transparent' },
          pointLabels: { color: textColor, font: { family: 'var(--font-ui)' } },
        },
      } : {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'var(--font-ui)' } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'var(--font-ui)' } } },
      },
    },
  };
}
