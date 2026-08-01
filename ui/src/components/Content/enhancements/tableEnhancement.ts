interface TableGlobals {
  states?: Record<string, { chartInstance?: { destroy(): void } }>;
  detectChartable?(tableId: string): void;
  ensureChartLibrary?: () => Promise<unknown>;
}

export interface TableEnhancementOptions {
  getChart: () => Promise<unknown>;
  tableGlobals?: TableGlobals;
  documentRoot?: Document;
}

const COLLAPSED_ROW_LIMIT = 15;
const MAX_RENDER_ATTEMPTS = 3;

export async function enhanceTables(
  root: ParentNode,
  options: TableEnhancementOptions,
): Promise<void> {
  const tables = [
    ...root.querySelectorAll<HTMLElement>('.mdn-table:not([data-mdn-enhanced]):not([data-mdn-render-error])'),
  ];
  if (tables.length === 0) return;

  const tableGlobals = options.tableGlobals;
  const detectChartable = tableGlobals?.detectChartable;
  if (!tableGlobals || typeof detectChartable !== 'function') return;

  const documentRoot = options.documentRoot ?? document;
  tableGlobals.ensureChartLibrary = options.getChart;

  tables.forEach((table) => {
    try {
      const rows = [...table.querySelectorAll<HTMLElement>('tbody tr')]
        .filter((row) => !row.dataset.toggle);
      const count = documentRoot.getElementById(`${table.id}-count`);
      if (count) count.textContent = `${rows.length} rows`;

      rows.forEach((row, index) => {
        row.dataset.mdnFilterMatch = 'true';
        row.classList.toggle('is-collapsed-row', index >= COLLAPSED_ROW_LIMIT);
      });

      const button = documentRoot.getElementById(`${table.id}-toggle-btn`);
      if (button) {
        button.style.display = rows.length > COLLAPSED_ROW_LIMIT ? '' : 'none';
        button.textContent = 'Show More';
      }

      const oldState = tableGlobals?.states?.[table.id];
      try {
        oldState?.chartInstance?.destroy();
      } catch {
        // A stale chart must not block the new table from initializing.
      }
      if (tableGlobals?.states) delete tableGlobals.states[table.id];
      detectChartable(table.id);
      table.dataset.mdnEnhanced = 'true';
      delete table.dataset.mdnRenderAttempts;
      delete table.dataset.mdnRenderError;
    } catch (error) {
      const attempts = Number.parseInt(table.dataset.mdnRenderAttempts || '0', 10) + 1;
      table.dataset.mdnRenderAttempts = String(attempts);
      if (attempts >= MAX_RENDER_ATTEMPTS) {
        table.dataset.mdnRenderError = 'true';
      }
      console.error(`Table enhancement error (${table.id || 'unknown'}):`, error);
    }
  });
}
