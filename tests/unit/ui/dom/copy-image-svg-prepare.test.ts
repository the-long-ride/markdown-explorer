import { describe, expect, it } from 'vitest';
import { prepareStandaloneSvgForRasterization } from '../../../../ui/src/dom/copyImage';

const NS = 'http://www.w3.org/2000/svg';
function svg(attrs: Record<string, string>) {
  const el = document.createElementNS(NS, 'svg') as SVGSVGElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const fo = document.createElementNS(NS, 'foreignObject');
  const div = document.createElement('div');
  div.textContent = 'label';
  div.style.color = 'red';
  div.style.fontSize = '12px';
  div.style.fontWeight = 'bold';
  div.style.fontStyle = 'italic';
  fo.appendChild(div);
  el.appendChild(fo);
  document.body.appendChild(el);
  return el;
}

describe('prepareStandaloneSvgForRasterization sizing', () => {
  it('falls back to viewBox, explicit attributes or defaults', () => {
    const viewBox = prepareStandaloneSvgForRasterization(svg({ viewBox: '0 0 320 240' }), '@font-face{}');
    expect(viewBox.width).toBeGreaterThan(0);
    expect(viewBox.svgXml).toContain('xmlns');
    const sized = prepareStandaloneSvgForRasterization(svg({ width: '150', height: '90', xmlns: NS, 'xmlns:xlink': 'http://www.w3.org/1999/xlink' }));
    expect(sized.width).toBeGreaterThan(0);
    const defaults = prepareStandaloneSvgForRasterization(svg({ width: 'abc', height: 'xyz' }));
    expect(defaults.width).toBeGreaterThan(0);
    expect(defaults.height).toBeGreaterThan(0);
  });
});
