import { describe, expect, it } from 'vitest';
import {
  curveArchitectureEdgePath,
  curveArchitectureEdges,
  enforceArchitectureGroupBounds,
  parseSvgPathPoints,
  repairArchitectureLabelCollisions,
} from '../../../../ui/src/components/Content/enhancements/mermaidArchitecture';

describe('mermaidArchitecture', () => {
  describe('parseSvgPathPoints', () => {
    it('parses valid M and L commands with various separators', () => {
      const d = 'M 10,20 L -30.5 40.25 M 50 -60';
      const points = parseSvgPathPoints(d);
      expect(points).toEqual([
        { cmd: 'M', x: 10, y: 20 },
        { cmd: 'L', x: -30.5, y: 40.25 },
        { cmd: 'M', x: 50, y: -60 },
      ]);
    });

    it('returns empty array for invalid or empty path string', () => {
      expect(parseSvgPathPoints('')).toEqual([]);
      expect(parseSvgPathPoints('Z C 1 2 3 4')).toEqual([]);
    });
  });

  describe('curveArchitectureEdgePath', () => {
    it('returns original path when fewer than 2 points are parsed', () => {
      expect(curveArchitectureEdgePath('M 10 20')).toBe('M 10 20');
      expect(curveArchitectureEdgePath('')).toBe('');
    });

    it('keeps pure horizontal and pure vertical 2-point lines straight', () => {
      expect(curveArchitectureEdgePath('M 10 20 L 100 20')).toBe('M 10,20 L 100,20');
      expect(curveArchitectureEdgePath('M 50 10 L 50 200')).toBe('M 50,10 L 50,200');
    });

    it('curves diagonal 2-point paths using bezier curves', () => {
      const curved = curveArchitectureEdgePath('M 0 0 L 100 50');
      expect(curved).toContain('M 0,0 C');
      expect(curved).toContain('100,50');

      // Test with downward arrow orientation
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('points', '0,0 6.6,13 13,0');
      const downCurved = curveArchitectureEdgePath('M 0 0 L 100 50', arrow as any);
      expect(downCurved).toContain('M 0,0 C');
    });

    it('applies quadratic fillet radius Q to multi-point waypoint paths', () => {
      const d = 'M 0 0 L 50 0 L 50 50 L 100 50';
      const result = curveArchitectureEdgePath(d);
      expect(result).toContain('Q 50,0');
      expect(result).toContain('Q 50,50');
      expect(result).toContain('L 100,50');
    });

    it('skips collinear waypoints cleanly without NaN', () => {
      const d = 'M 0 0 L 50 0 L 100 0';
      const result = curveArchitectureEdgePath(d);
      expect(result).toContain('M 0,0');
      expect(result).toContain('100,0');
    });

    it('preserves repeated waypoints without creating invalid coordinates', () => {
      expect(curveArchitectureEdgePath('M 0 0 L 0 0 L 50 0 L 50 0 L 50 50')).toBe('M 0,0 L 0,0 L 50,0 L 50,0 L 50,50');
      expect(parseSvgPathPoints('M . . L 10 20')).toEqual([{ cmd: 'L', x: 10, y: 20 }]);
    });
  });

  describe('curveArchitectureEdges and enforceArchitectureGroupBounds', () => {
    it.each([
      ['13,0 0,6.6 13,13', 'M 0,0 C 40,0 40,40 80,40'],
      ['6.6,0 0,13.33 13.33,13.33', 'M 0,0 C 0,20 80,20 80,40'],
      ['0,0 6.6,13 13,0', 'M 0,0 C 0,20 80,20 80,40'],
    ])('curves the edge to meet the arrow orientation %s', (points, expected) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = `<g class="architecture-edges"><g><path class="edge" d="M 0,0 L 80,40" /><polygon class="arrow" points="${points}" /></g></g>`;
      expect(curveArchitectureEdges(svg)).toBe(1);
      expect(svg.querySelector('path')?.getAttribute('d')).toBe(expected);
    });

    it('skips missing paths and marks straight edges without reporting them as curved', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = '<g class="architecture-edges"><g><polygon /></g><g><path class="edge" /></g><g><path class="edge" d="M 0,0 L 80,0" /></g></g>';
      expect(curveArchitectureEdges(svg)).toBe(0);
      const [empty, straight] = svg.querySelectorAll('path');
      expect(empty.hasAttribute('data-mdn-architecture-edge-curved')).toBe(false);
      expect(straight.getAttribute('data-mdn-architecture-edge-curved')).toBe('true');
      expect(straight.getAttribute('d')).toBe('M 0,0 L 80,0');
    });

    it('curves edges and marks them with data-mdn-architecture-edge-curved', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = `
        <g class="architecture-edges">
          <g>
            <path class="edge" d="M 0 0 L 100 100" />
            <polygon class="arrow" points="0,0 6.6,13 13,0" />
          </g>
        </g>
      `;
      const count = curveArchitectureEdges(svg);
      expect(count).toBe(1);

      const path = svg.querySelector('path.edge')!;
      expect(path.getAttribute('data-mdn-architecture-edge-curved')).toBe('true');
      expect(path.getAttribute('d')).toContain('C');

      // Second run does not re-curve already marked paths
      expect(curveArchitectureEdges(svg)).toBe(0);
    });

    it('curves standalone paths without edge groups container', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = '<path class="edge" d="M 0 0 L 80 40" />';
      expect(curveArchitectureEdges(svg)).toBe(1);
    });

    it('enforces group rounded corners rx and ry', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = `
        <g class="architecture-groups">
          <rect class="node-bkg" x="0" y="0" width="100" height="100" />
        </g>
      `;
      const modified = enforceArchitectureGroupBounds(svg);
      expect(modified).toBe(1);
      const rect = svg.querySelector('rect')!;
      expect(rect.getAttribute('rx')).toBe('8');
      expect(rect.getAttribute('ry')).toBe('8');
      expect(rect.getAttribute('data-mdn-architecture-group-refined')).toBe('true');

      // Second run skips already marked rect
      expect(enforceArchitectureGroupBounds(svg)).toBe(0);
    });
  });

  describe('repairArchitectureLabelCollisions', () => {
    it('styles service labels with font and text halos', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = `
        <g class="architecture-service">
          <g class="architecture-service-label">
            <text>Service Name</text>
            <tspan>Sublabel</tspan>
          </g>
        </g>
        <g class="service">
          <text>Legacy Service</text>
        </g>
      `;
      repairArchitectureLabelCollisions(svg);

      const label = svg.querySelector('.architecture-service-label') as HTMLElement;
      expect(label.style.fontFamily).toBe('var(--font-mermaid)');

      const text = svg.querySelector('text') as HTMLElement;
      expect(text.style.paintOrder).toBe('stroke fill');
      expect(text.style.strokeWidth).toBe('2.5px');
    });

    it('handles empty or malformed SVGs gracefully', () => {
      expect(repairArchitectureLabelCollisions({} as any)).toBe(0);
    });

    it('styles legacy native labels and foreignObject labels without text children', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = `<g class="service">
        <text>Legacy service</text>
        <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML service</div></foreignObject>
      </g><path class="edge" /><path class="edge" d="M 0 0 L 50 20" />`;
      repairArchitectureLabelCollisions(svg);
      for (const label of svg.querySelectorAll<SVGElement>('text, foreignObject')) {
        expect(label.style.fontFamily).toBe('var(--font-mermaid)');
        expect(label.style.paintOrder).toBe('stroke fill');
      }
      const [incomplete, complete] = svg.querySelectorAll('path');
      expect(incomplete).not.toHaveAttribute('data-mdn-architecture-edge-curved');
      expect(complete).toHaveAttribute('data-mdn-architecture-edge-curved', 'true');
      expect(curveArchitectureEdges(svg)).toBe(0);
    });
  });
});
