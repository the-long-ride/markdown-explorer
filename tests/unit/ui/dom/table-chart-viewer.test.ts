import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHART_SCALE_STEP,
  MAX_CHART_SCALE,
  MIN_CHART_SCALE,
  isPointInsideChartArea,
  isPointInsideChartLegend,
  registerTableChartViewer,
} from '../../../../ui/src/dom/tableChartViewer.ts';

describe('tableChartViewer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('scale constants', () => {
    it('defines standard scale boundaries and step', () => {
      expect(MIN_CHART_SCALE).toBe(50);
      expect(MAX_CHART_SCALE).toBe(1000);
      expect(CHART_SCALE_STEP).toBe(10);
    });
  });

  describe('isPointInsideChartArea', () => {
    it('returns false if chart or chartArea is missing', () => {
      const canvas = document.createElement('canvas');
      const event = new MouseEvent('mousemove', { clientX: 10, clientY: 10 });
      expect(isPointInsideChartArea(null, event, canvas)).toBe(false);
      expect(isPointInsideChartArea({}, event, canvas)).toBe(false);
    });

    it('returns false if canvas has zero dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.getBoundingClientRect = () => ({
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      const chart = { chartArea: { left: 0, right: 100, top: 0, bottom: 100 } };
      const event = new MouseEvent('mousemove', { clientX: 50, clientY: 50 });
      expect(isPointInsideChartArea(chart, event, canvas)).toBe(false);
    });

    it('detects point inside chartArea or scales', () => {
      const canvas = document.createElement('canvas');
      canvas.getBoundingClientRect = () => ({
        width: 200,
        height: 200,
        left: 0,
        top: 0,
        right: 200,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const chart = {
        width: 200,
        height: 200,
        chartArea: { left: 20, right: 180, top: 20, bottom: 180 },
        scales: {
          x: { left: 20, right: 180, top: 180, bottom: 200 },
        },
      };

      const insidePlot = new MouseEvent('mousemove', { clientX: 50, clientY: 50 });
      expect(isPointInsideChartArea(chart, insidePlot, canvas)).toBe(true);

      const insideScale = new MouseEvent('mousemove', { clientX: 50, clientY: 190 });
      expect(isPointInsideChartArea(chart, insideScale, canvas)).toBe(true);

      const outside = new MouseEvent('mousemove', { clientX: 5, clientY: 5 });
      expect(isPointInsideChartArea(chart, outside, canvas)).toBe(false);
    });
  });

  describe('isPointInsideChartLegend', () => {
    it('returns false if hitBoxes are missing or point is outside', () => {
      const canvas = document.createElement('canvas');
      const event = new MouseEvent('mousemove', { clientX: 10, clientY: 10 });
      expect(isPointInsideChartLegend(null, event, canvas)).toBe(false);
      expect(isPointInsideChartLegend({ legend: {} }, event, canvas)).toBe(false);
    });

    it('detects point inside hitBoxes accurately', () => {
      const canvas = document.createElement('canvas');
      canvas.getBoundingClientRect = () => ({
        width: 200,
        height: 200,
        left: 0,
        top: 0,
        right: 200,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const chart = {
        width: 200,
        height: 200,
        legend: {
          legendHitBoxes: [
            { left: 10, top: 10, width: 40, height: 20 },
            { left: 60, top: 10, width: 40, height: 20 },
          ],
        },
      };

      const insideBox = new MouseEvent('mousemove', { clientX: 25, clientY: 15 });
      expect(isPointInsideChartLegend(chart, insideBox, canvas)).toBe(true);

      const outsideBox = new MouseEvent('mousemove', { clientX: 55, clientY: 15 });
      expect(isPointInsideChartLegend(chart, outsideBox, canvas)).toBe(false);
    });
  });

  describe('registerTableChartViewer', () => {
    function setupMockWindow() {
      const mockChartInstance = {
        destroy: vi.fn(),
        update: vi.fn(),
        resize: vi.fn(),
        chartArea: { left: 0, right: 300, top: 0, bottom: 200 },
        legend: { height: 40, legendHitBoxes: [] },
      };

      function MockChartConstructor(this: any) {
        return mockChartInstance;
      }
      (MockChartConstructor as any).getChart = vi.fn(() => mockChartInstance);

      const win: any = {
        Chart: MockChartConstructor,
        Table: {
          initState: vi.fn(() => ({
            columns: ['A', 'B'],
            dataColIdxs: [1],
            scatterColIdxs: [1],
            hiddenColumnIdxs: [],
            series: [{ name: 'A', values: [1, 2] }],
            chartInstance: mockChartInstance,
          })),
        },
      };

      return { win, mockChartInstance };
    }

    it('binds canvas and updates cursor on hover and opens viewer on click', () => {
      const { win, mockChartInstance } = setupMockWindow();
      const canvas = document.createElement('canvas');
      canvas.id = 'tbl1-chart-canvas';
      canvas.getBoundingClientRect = () => ({
        width: 300,
        height: 200,
        left: 0,
        top: 0,
        right: 300,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      document.body.appendChild(canvas);

      const createPayload = vi.fn(() => ({
        config: { type: 'bar', data: { datasets: [] } },
        width: 400,
        height: 300,
        viewType: 'bar',
      }));

      registerTableChartViewer(win, createPayload);
      win.Table.bindChartCanvas('tbl1', 'bar');

      expect(canvas.dataset.mdnChartViewerBound).toBe('true');

      // Hover over area -> cursor becomes zoom-in
      canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }));
      expect(canvas.style.cursor).toBe('zoom-in');

      // Leave -> cursor resets
      canvas.dispatchEvent(new MouseEvent('pointerleave'));
      expect(canvas.style.cursor).toBe('default');

      // Click -> opens chart viewer
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 50 }));
      expect(document.querySelector('.mdn-chart-viewer')).not.toBeNull();

      // Close viewer
      win.Table.closeChartViewer();
      expect(document.querySelector('.mdn-chart-viewer')).toBeNull();
    });

    it('handles viewer toolbar actions: zoom in, zoom out, 100%, and fit', () => {
      const { win } = setupMockWindow();
      const createPayload = vi.fn(() => ({
        config: { type: 'bar', data: { datasets: [] } },
        width: 400,
        height: 300,
        viewType: 'bar',
      }));

      registerTableChartViewer(win, createPayload);
      win.Table.openChartViewer('tbl1', 'bar');

      const viewer = document.querySelector('.mdn-chart-viewer')!;
      expect(viewer).not.toBeNull();

      const zoomText = viewer.querySelector('.mdn-modal-zoom-text')!;
      expect(zoomText.textContent).toBe('100%');

      // Click zoom in
      const zoomInBtn = viewer.querySelector('[data-chart-action="zoom-in"]') as HTMLButtonElement;
      zoomInBtn.click();
      expect(zoomText.textContent).toBe('110%');

      // Click zoom out
      const zoomOutBtn = viewer.querySelector('[data-chart-action="zoom-out"]') as HTMLButtonElement;
      zoomOutBtn.click();
      expect(zoomText.textContent).toBe('100%');

      // Click 100% reset
      zoomInBtn.click();
      const resetBtn = viewer.querySelector('[data-chart-action="100"]') as HTMLButtonElement;
      resetBtn.click();
      expect(zoomText.textContent).toBe('100%');

      // Click fit
      const fitBtn = viewer.querySelector('[data-chart-action="fit"]') as HTMLButtonElement;
      fitBtn.click();
      expect(zoomText.textContent).toMatch(/\d+%/);

      // Close viewer via close button
      const closeBtn = viewer.querySelector('[data-chart-action="close"]') as HTMLButtonElement;
      closeBtn.click();
      expect(document.querySelector('.mdn-chart-viewer')).toBeNull();
    });

    it('toggles chart type menu and handles Escape key', () => {
      const { win } = setupMockWindow();
      const createPayload = vi.fn(() => ({
        config: { type: 'bar', data: { datasets: [] } },
        width: 400,
        height: 300,
        viewType: 'bar',
      }));

      registerTableChartViewer(win, createPayload);
      win.Table.openChartViewer('tbl1', 'bar');

      const viewer = document.querySelector('.mdn-chart-viewer')!;
      const toggleMenuBtn = viewer.querySelector('[data-chart-action="toggle-type-menu"]') as HTMLButtonElement;
      toggleMenuBtn.click();

      const typeDropdown = viewer.querySelector('.mdn-chart-viewer__type-dropdown')!;
      expect(typeDropdown.classList.contains('is-open')).toBe(true);

      // Escape closes the menu first
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(typeDropdown.classList.contains('is-open')).toBe(false);
      expect(document.querySelector('.mdn-chart-viewer')).not.toBeNull();

      // Second Escape closes the viewer
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.mdn-chart-viewer')).toBeNull();
    });
  });
});
