import { usesItemLegend } from './tableChartViews';

function cloneChartData(data: any): any {
  if (!data) return data;
  return {
    ...data,
    labels: Array.isArray(data.labels) ? [...data.labels] : data.labels,
    datasets: Array.isArray(data.datasets)
      ? data.datasets.map((dataset: any) => ({
        ...dataset,
        data: Array.isArray(dataset.data)
          ? dataset.data.map((point: any) => point && typeof point === 'object' ? { ...point } : point)
          : dataset.data,
      }))
      : data.datasets,
  };
}

export function buildPlotConfig(baseConfig: any): any {
  const options = baseConfig?.options ?? {};
  const plugins = options.plugins ?? {};
  return {
    ...baseConfig,
    data: cloneChartData(baseConfig?.data),
    options: {
      ...options,
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        ...plugins,
        legend: { ...(plugins.legend ?? {}), display: false },
      },
    },
  };
}

export function buildLegendConfig(baseConfig: any, onLegendClick: (item: any, chart: any) => void): any {
  const options = baseConfig?.options ?? {};
  const plugins = options.plugins ?? {};
  const sourceScales = options.scales;
  const scales = sourceScales
    ? Object.fromEntries(Object.entries(sourceScales).map(([key, scale]: [string, any]) => [key, {
      ...scale,
      display: false,
      grid: { ...(scale?.grid ?? {}), display: false },
      ticks: { ...(scale?.ticks ?? {}), display: false },
      title: { ...(scale?.title ?? {}), display: false },
    }]))
    : undefined;
  const legendOnlyPlugin = {
    id: 'mdnLegendOnly',
    afterDraw(chart: any) {
      const area = chart.chartArea;
      if (!area) return;
      chart.ctx.clearRect(area.left - 2, area.top - 2, area.right - area.left + 4, area.bottom - area.top + 4);
    },
  };

  return {
    ...baseConfig,
    data: cloneChartData(baseConfig?.data),
    plugins: [...(Array.isArray(baseConfig?.plugins) ? baseConfig.plugins : []), legendOnlyPlugin],
    options: {
      ...options,
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales,
      plugins: {
        ...plugins,
        tooltip: { ...(plugins.tooltip ?? {}), enabled: false },
        legend: {
          ...(plugins.legend ?? {}),
          display: true,
          position: 'top',
          onClick: (_event: unknown, item: any, legend: any) => onLegendClick(item, legend.chart),
        },
      },
    },
  };
}

export function applyChartVisibility(chart: any, viewType: string, hiddenDatasets: Set<number>, hiddenItems: Set<number>) {
  if (!chart) return;
  if (usesItemLegend(viewType)) {
    const itemCount = chart.data?.labels?.length ?? 0;
    for (let index = 0; index < itemCount; index += 1) {
      const shouldShow = !hiddenItems.has(index);
      if (chart.getDataVisibility?.(index) !== shouldShow) chart.toggleDataVisibility?.(index);
    }
    return;
  }
  const datasetCount = chart.data?.datasets?.length ?? 0;
  for (let index = 0; index < datasetCount; index += 1) chart.setDatasetVisibility?.(index, !hiddenDatasets.has(index));
}

export function captureChartVisibility(chart: any, viewType: string, hiddenDatasets: Set<number>, hiddenItems: Set<number>) {
  if (!chart) return;
  if (usesItemLegend(viewType)) {
    const itemCount = chart.data?.labels?.length ?? 0;
    for (let index = 0; index < itemCount; index += 1) {
      if (chart.getDataVisibility?.(index) === false) hiddenItems.add(index);
    }
    return;
  }
  const datasetCount = chart.data?.datasets?.length ?? 0;
  for (let index = 0; index < datasetCount; index += 1) {
    if (chart.isDatasetVisible?.(index) === false) hiddenDatasets.add(index);
  }
}

export function toggleChartLegendVisibility(
  item: any,
  viewType: string,
  hiddenDatasets: Set<number>,
  hiddenItems: Set<number>,
  charts: any[],
) {
  if (usesItemLegend(viewType) && Number.isInteger(item?.index)) {
    const index = Number(item.index);
    if (hiddenItems.has(index)) hiddenItems.delete(index); else hiddenItems.add(index);
  } else if (Number.isInteger(item?.datasetIndex)) {
    const index = Number(item.datasetIndex);
    if (hiddenDatasets.has(index)) hiddenDatasets.delete(index); else hiddenDatasets.add(index);
  }
  charts.filter(Boolean).forEach((chart) => {
    applyChartVisibility(chart, viewType, hiddenDatasets, hiddenItems);
    chart.update?.();
  });
}

export function composeChartCanvases(plotCanvas: HTMLCanvasElement, legendCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
  if (!plotCanvas.width || !plotCanvas.height || !legendCanvas.width) return null;
  const output = document.createElement('canvas');
  output.width = Math.max(plotCanvas.width, legendCanvas.width);
  output.height = plotCanvas.height + legendCanvas.height;
  const context = output.getContext('2d');
  if (!context) return null;
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
  context.fillStyle = background;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(plotCanvas, Math.round((output.width - plotCanvas.width) / 2), 0);
  context.drawImage(legendCanvas, Math.round((output.width - legendCanvas.width) / 2), plotCanvas.height);
  return output;
}
