import { describe, expect, it } from 'vitest';
import { buildTableChartConfig } from '../../../../ui/src/dom/tableChartConfig';

function setup() {
  document.body.innerHTML = `<table><thead><tr><th><span class="mdn-th-text">Name</span></th><th><span class="mdn-th-text">X</span></th><th></th></tr></thead>
    <tbody><tr><td>${'L'.repeat(60)}</td><td>1</td><td>abc</td></tr><tr><td>b</td><td>2.5</td></tr></tbody></table>`;
  const table = document.querySelector('table')!;
  return { table, chartRows: Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[] };
}

describe('buildTableChartConfig view types', () => {
  it('builds configs for every view type including scatter', () => {
    const { table, chartRows } = setup();
    for (const viewType of ['scatter', 'area', 'radar', 'horizontalBar', 'doughnut', 'pie', 'line', 'bar', 'polarArea']) {
      const config = buildTableChartConfig({ tableId: 't', viewType, table, chartRows, labelColIdx: 0, visibleColumns: [1, 2, 5], getChartColors: (n: number) => Array(n).fill('#123456') } as any);
      expect(config.data.datasets.length).toBeGreaterThan(0);
      if (viewType === 'scatter') expect(config.data.labels).toBeUndefined();
      if (viewType === 'horizontalBar') expect(config.options.indexAxis).toBe('y');
    }
  });
});
