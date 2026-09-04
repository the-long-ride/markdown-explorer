import { describe, expect, it, vi } from 'vitest';
import {
  applySankeyIntrinsicWidth,
  estimateSankeyIntrinsicWidth,
  raiseSankeyLabels,
  repairSankeyLabelCollisions,
} from '../../../../ui/src/components/Content/enhancements/mermaidSankey';

describe('mermaidSankey', () => {
  describe('estimateSankeyIntrinsicWidth', () => {
    it('estimates width for simple sankey source', () => {
      const source = `
        sankey-beta
        %% Comment line
        "A", "B", 10
        B, C, 20
      `;
      const width = estimateSankeyIntrinsicWidth(source);
      expect(width).toBeGreaterThanOrEqual(760);
      expect(width).toBeLessThanOrEqual(1800);
    });

    it('handles quoted labels with commas correctly', () => {
      const source = `
        sankey-beta
        "Category, Primary", "Output, Final", 100
        "Category, Secondary", "Output, Final", 50
      `;
      const width = estimateSankeyIntrinsicWidth(source);
      expect(width).toBeGreaterThanOrEqual(760);
    });

    it('respects containerWidth when greater than estimated width', () => {
      const source = 'sankey-beta\nA, B, 10';
      const width = estimateSankeyIntrinsicWidth(source, 1200);
      expect(width).toBe(1200);
    });

    it('clamps to MAX 1800 for huge sankey diagrams', () => {
      const lines = ['sankey-beta'];
      for (let i = 0; i < 50; i++) {
        lines.push(`NodeVeryLongLabel${i}, NodeVeryLongLabel${i + 1}, 10`);
      }
      const width = estimateSankeyIntrinsicWidth(lines.join('\n'));
      expect(width).toBe(1800);
    });

    it('handles cyclic relationships gracefully via fallback levels', () => {
      const source = `
        sankey-beta
        A, B, 10
        B, C, 10
        C, A, 5
      `;
      const width = estimateSankeyIntrinsicWidth(source);
      expect(width).toBeGreaterThanOrEqual(760);
    });
  });

  describe('applySankeyIntrinsicWidth', () => {
    it('applies width styles and attributes to svg and wrapper', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const wrapper = document.createElement('div');
      wrapper.appendChild(svg);

      const source = 'sankey-beta\nA, B, 10';
      const width = applySankeyIntrinsicWidth(svg, wrapper, source, 850);
      expect(width).toBe(850);
      expect(svg.getAttribute('width')).toBe('850');
      expect(svg.style.width).toBe('850px');
      expect(svg.style.minWidth).toBe('850px');
      expect(wrapper.style.overflowX).toBe('auto');
    });

    it('works without wrapper element', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const width = applySankeyIntrinsicWidth(svg, null, 'sankey-beta\nA, B, 10', 900);
      expect(width).toBe(900);
      expect(svg.getAttribute('width')).toBe('900');
    });
  });

  describe('raiseSankeyLabels', () => {
    it('moves node-labels container to the end of its parent', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const labels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labels.setAttribute('class', 'node-labels');
      const links = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      links.setAttribute('class', 'links');
      svg.appendChild(labels);
      svg.appendChild(links);

      expect(svg.lastElementChild).toBe(links);
      raiseSankeyLabels(svg);
      expect(svg.lastElementChild).toBe(labels);
    });
  });

  describe('repairSankeyLabelCollisions', () => {
    it('returns 0 for svgs with fewer than 2 labels or invalid structure', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      expect(repairSankeyLabelCollisions(svg)).toBe(0);
      expect(repairSankeyLabelCollisions({} as any)).toBe(0);
    });

    it('deconflicts overlapping labels vertically in the same column', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 500 500');
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'node-labels');

      const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text1.setAttribute('x', '100');
      text1.setAttribute('y', '50');
      text1.textContent = 'Label 1';
      // Mock getBBox on SVG element in jsdom
      text1.getBBox = () => ({ x: 100, y: 50, width: 60, height: 20 } as any);

      const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text2.setAttribute('x', '100');
      text2.setAttribute('y', '55'); // Overlaps text1 vertically
      text2.textContent = 'Label 2';
      text2.getBBox = () => ({ x: 100, y: 55, width: 60, height: 20 } as any);

      group.appendChild(text1);
      group.appendChild(text2);
      svg.appendChild(group);

      const shiftedCount = repairSankeyLabelCollisions(svg, { gap: 8 });
      expect(shiftedCount).toBeGreaterThan(0);
      expect(text2.getAttribute('data-mdn-sankey-label-shift')).toBeDefined();
      const shiftVal = Number(text2.getAttribute('data-mdn-sankey-label-shift'));
      expect(shiftVal).toBeGreaterThan(0);
    });
  });
});
