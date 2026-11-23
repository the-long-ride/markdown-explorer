import { describe, expect, it } from 'vitest';
import { renderLegendItems } from '../../../../ui/src/dom/tableChartViewerLegend';

describe('renderLegendItems', () => {
  it('renders one item per label for item legends with per-item colours', () => {
    const html = renderLegendItems({
      data: { labels: ['A<b>', null, 'C'], datasets: [{ backgroundColor: ['#111', '#222'], borderColor: '"x"' }] },
    }, 'pie', new Set(), new Set([1]));
    const root = document.createElement('div');
    root.innerHTML = html;
    const items = [...root.querySelectorAll('button')];
    expect(items.map(item => item.textContent)).toEqual(['A<b>', '', 'C']);
    expect(items[1].classList.contains('is-hidden')).toBe(true);
    expect(items[1].getAttribute('aria-pressed')).toBe('false');
    expect(items[2].innerHTML).toContain('--mdn-legend-fill:#111');
    expect(html).toContain('&quot;x&quot;');
  });

  it('handles item legends without datasets or labels', () => {
    expect(renderLegendItems({ data: {} }, 'pie', new Set(), new Set())).toBe('');
    expect(renderLegendItems({ data: { labels: ['only'] } }, 'doughnut', new Set(), new Set())).toContain('currentColor');
    expect(renderLegendItems(null, 'pie', new Set(), new Set())).toBe('');
  });

  it('renders one item per dataset for series legends', () => {
    const html = renderLegendItems({
      data: { datasets: [{ label: 'Sales', backgroundColor: 'red', borderColor: ['blue'] }, null, { backgroundColor: [] }] },
    }, 'bar', new Set([0]), new Set());
    expect(html).toContain('Sales');
    expect(html).toContain('Series 2');
    expect(html).toContain('Series 3');
    expect(html).toContain('--mdn-legend-stroke:blue');
    expect(html).toContain('is-hidden');
    expect(renderLegendItems({}, 'line', new Set(), new Set())).toBe('');
  });
});
