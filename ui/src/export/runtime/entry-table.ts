import { registerTableHandlers } from '../../dom/tableHandlers';

type TableWindow = Window & {
  UI?: Record<string, unknown>;
  Table?: Record<string, any>;
  Chart?: unknown;
};

const win = window as TableWindow;
win.UI ??= {};
registerTableHandlers(win);
if (win.Table) {
  win.Table.ensureChartLibrary = async () => win.Chart;
  document.querySelectorAll<HTMLTableElement>('.mdn-table').forEach((table) => {
    if (!table.id) return;
    win.Table?.initState?.(table.id);
    win.Table?.detectChartable?.(table.id);
    win.Table?.applyAllFilters?.(table.id);
  });
}
