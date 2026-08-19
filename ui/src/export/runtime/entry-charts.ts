import Chart from 'chart.js/auto';

type ChartWindow = Window & {
  Chart?: typeof Chart;
  Table?: Record<string, any>;
  __mdnExportCharts?: string;
};

const win = window as ChartWindow;
win.Chart = Chart;
win.__mdnExportCharts = 'chart.js-local';
if (win.Table) {
  win.Table.ensureChartLibrary = async () => Chart;
}
