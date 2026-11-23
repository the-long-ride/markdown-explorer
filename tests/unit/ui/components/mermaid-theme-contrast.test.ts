import { describe, expect, it, vi } from 'vitest';
import {
  buildMermaidC4ThemeConfig,
  buildMermaidThemeVariables,
  buildSoftCategoricalFills,
  chooseMermaidForeground,
  mermaidContrastRatio,
  parseMermaidColor,
  readMermaidThemeTokens,
} from '../../../../ui/src/components/Content/enhancements/mermaidTheme';
import {
  chooseNeutralMermaidForeground,
  enforceMermaidSvgContrast,
} from '../../../../ui/src/components/Content/enhancements/mermaidContrast';

describe('Mermaid theme colors', () => {
  it.each([
    [' #Ab3 ', { r: 170, g: 187, b: 51, a: 1 }],
    ['#abc8', { r: 170, g: 187, b: 204, a: 136 / 255 }],
    ['#abcdef40', { r: 171, g: 205, b: 239, a: 64 / 255 }],
    ['rgb(0%, 100%, 0% / 50%)', { r: 0, g: 255, b: 0, a: 0.5 }],
    ['rgba(-20, 256, 127, 2)', { r: 0, g: 255, b: 127, a: 1 }],
    ['rgb(1 2 3)', { r: 1, g: 2, b: 3, a: 1 }],
    ['none', { r: 0, g: 0, b: 0, a: 0 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
    [' ', { r: 0, g: 0, b: 0, a: 0 }],
  ])('parses diagram color %s', (value, expected) => {
    expect(parseMermaidColor(value)).toEqual(expected);
  });

  it.each([null, undefined, '', '#abcde', 'url(#gradient)', 'rgb(1 2)', 'rgb(x% 2 3)', 'rgb(1 x 3)', 'rgb(1 2 x)', 'rgba(1 2 3 x%)', 'rgba(1 2 3 x)'])(
    'rejects unsupported color %s', (value) => expect(parseMermaidColor(value)).toBeNull(),
  );

  it('measures contrast after compositing and handles unknown paints', () => {
    expect(mermaidContrastRatio('#000', '#fff')).toBeCloseTo(21);
    expect(mermaidContrastRatio('rgba(0 0 0 / 0.5)', 'rgba(0 0 0 / 0.5)'))
      .toBeCloseTo(mermaidContrastRatio('rgb(63.75 63.75 63.75)', 'rgb(127.5 127.5 127.5)'));
    expect(mermaidContrastRatio('#111', 'url(#gradient)')).toBe(1);
    expect(mermaidContrastRatio('url(#gradient)', '#111')).toBe(1);
  });

  it('preserves sufficient authored contrast, otherwise uses the first passing or best candidate', () => {
    expect(chooseMermaidForeground('#fff', ['#000'], { currentForeground: '#333' })).toBe('#333');
    expect(chooseMermaidForeground('transparent', ['#333', '#fff'], {
      currentForeground: '#000', fallbackFill: '#111',
    })).toBe('#fff');
    expect(chooseMermaidForeground('#fff', ['#ddd', '#eee', '#ccc'])).toBe('#ccc');
    expect(chooseMermaidForeground('#fff', [], { currentForeground: '#ddd' })).toBe('#ddd');
    expect(chooseMermaidForeground('#fff', [])).toBe('#000000');
  });

  it('reads CSS theme values and falls back when the document or values are unavailable', () => {
    const doc = document.implementation.createHTMLDocument();
    const root = document.createElement('div');
    root.style.setProperty('--bg', ' #223344 ');
    root.style.setProperty('--chart-6', '#123456');
    expect(readMermaidThemeTokens({ documentElement: root, defaultView: window }, true)).toMatchObject({
      background: '#223344', surface: '#1d1f24', chart6: '#123456',
    });
    expect(readMermaidThemeTokens(doc, false).background).toBe('#ffffff');
    expect(readMermaidThemeTokens(undefined, true).background).toBe('#15171b');
  });

  it('cycles unique categorical anchors and caps neutral-fill contrast loss', () => {
    const tokens = {
      ...readMermaidThemeTokens(undefined, false),
      surface: '#ffffff',
      text: '#707070',
      chart1: '#000000',
      chart2: '#000000',
      chart3: '#ff0000',
      chart4: '',
      chart5: undefined,
      chart6: undefined,
    };
    expect(buildSoftCategoricalFills(tokens, 0)).toEqual([]);
    expect(buildSoftCategoricalFills(tokens, 3)).toEqual(['#808080', '#ff8080', '#808080']);
    expect(buildSoftCategoricalFills({ ...tokens, chart1: 'invalid' }, 1)).toEqual(['#ffffff']);
    const neutral = buildMermaidThemeVariables(tokens, false);
    const categorical = buildMermaidThemeVariables(tokens, false, { categoricalFills: true, softFillCount: 2 });
    expect(neutral.pie6).toBe(neutral.pie5);
    expect(mermaidContrastRatio(neutral.pieSectionTextColor, neutral.pie6)).toBeGreaterThanOrEqual(4.5);
    expect(categorical).toMatchObject({ pie1: '#808080', pie2: '#ff8080', quadrant4Fill: '#ff8080' });
    expect(categorical.xyChart.plotColorPalette.split(', ')).toHaveLength(6);
    const noAnchors = buildMermaidThemeVariables({ ...tokens, chart1: '', chart2: '', chart3: '' }, false, { categoricalFills: true });
    expect(noAnchors.pie1).toBe(neutral.pie1);
    expect(noAnchors.xyChart.plotColorPalette).toBe(neutral.xyChart.plotColorPalette);
  });

  it('reuses readable task and C4 borders against their respective backgrounds', () => {
    const tokens = { ...readMermaidThemeTokens(undefined, true), success: '#15171b' };
    const variables = buildMermaidThemeVariables(tokens, true);
    const c4 = buildMermaidC4ThemeConfig(tokens);
    expect(variables.doneTaskBorderColor).not.toBe(tokens.success);
    expect(variables.critBorderColor).toBe(tokens.danger);
    expect(mermaidContrastRatio(c4.external_system_border_color, c4.external_system_bg_color)).toBeGreaterThanOrEqual(3);
    expect(mermaidContrastRatio(c4.container_border_color, c4.container_bg_color)).toBeGreaterThanOrEqual(3);
  });
});

const bounds = { x: 0, y: 0, width: 60, height: 20 };
const layerSelector = '[data-mdn-mermaid-contrast-layer]';
const defsSelector = '[data-mdn-mermaid-contrast-defs]';
const tokens = readMermaidThemeTokens(undefined, false);

function diagram(markup: string): SVGSVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  element.innerHTML = markup;
  return element;
}

function geometry(svg: SVGSVGElement, selector: string, box = bounds, matrix?: object) {
  const element = svg.querySelector(selector)!;
  Object.assign(element, { getBBox: () => box, getCTM: () => matrix });
  return element;
}

describe('Mermaid SVG text contrast', () => {
  it('chooses foreground against translucent paint and degrades for unknown paint', () => {
    expect(chooseNeutralMermaidForeground('rgb(0 0 0 / 10%)', tokens)).toBe('#111111');
    expect(chooseNeutralMermaidForeground('rgb(0 0 0 / 90%)', tokens)).toBe('#ffffff');
    expect(chooseNeutralMermaidForeground('url(#unknown)', tokens)).toBe(tokens.text);
  });

  it('clips alternate foreground to intersecting artwork and preserves paint order on repeat', () => {
    const svg = diagram(`
      <defs><rect id="not-painted" fill="#000" /></defs>
      <g>
        <rect id="dark" style="fill: #000" />
        <rect id="transparent" fill="#000" style="fill-opacity: 0" />
        <rect id="hidden" fill="#000" opacity="0" style="opacity: 0" />
        <rect id="far" fill="#000" />
        <rect id="invalid" fill="#000" />
        <text id="title"><tspan id="part">Contrast</tspan></text>
        <path id="after" fill="none" />
      </g>
    `);
    for (const id of ['dark', 'transparent', 'hidden', 'not-painted', 'title']) geometry(svg, `#${id}`);
    geometry(svg, '#far', { ...bounds, x: 200 });
    geometry(svg, '#invalid', { ...bounds, width: -2 });
    for (let pass = 0; pass < 2; pass += 1) {
      enforceMermaidSvgContrast(svg, tokens);
      const layers = svg.querySelectorAll(layerSelector);
      expect(layers).toHaveLength(1);
      const layer = layers[0];
      expect(svg.querySelector('#title')?.nextElementSibling).toBe(layer);
      expect(layer.nextElementSibling?.id).toBe('after');
      expect(layer).toHaveAttribute('aria-hidden', 'true');
      expect(layer).not.toHaveAttribute('id');
      expect(layer.querySelector('tspan')).not.toHaveAttribute('id');
      expect(layer.querySelector('tspan')).toHaveAttribute('fill', '#ffffff');
      expect(svg.querySelector('#title')).toHaveAttribute('fill', '#111111');
      expect(svg.querySelectorAll(`${defsSelector} clipPath`)).toHaveLength(1);
      expect(svg.querySelector(`${defsSelector} clipPath rect`)).not.toHaveAttribute('style');
    }
  });

  it('keeps base label paint when an overlapping label cannot be cloned', () => {
    const svg = diagram('<rect id="background" fill="#000"/><text id="label">Text</text>');
    geometry(svg, '#background');
    const label = geometry(svg, '#label');
    vi.spyOn(label, 'cloneNode').mockImplementation(() => { throw new DOMException('Cannot copy label'); });
    enforceMermaidSvgContrast(svg, tokens);
    expect(label.cloneNode).toHaveBeenCalledOnce();
    expect(svg.querySelector(layerSelector)).toBeNull();
    expect(label).toHaveAttribute('fill', '#111111');
  });

  it('keeps later labels readable if creating a clip for one painted shape fails', () => {
    const svg = diagram('<rect id="failed" fill="#000"/><rect id="valid" fill="#000"/><text id="label">Text</text>');
    const failed = geometry(svg, '#failed');
    geometry(svg, '#valid');
    geometry(svg, '#label');
    vi.spyOn(failed, 'cloneNode').mockImplementation(() => { throw new DOMException('Cannot copy shape'); });
    enforceMermaidSvgContrast(svg, tokens);
    expect(failed.cloneNode).toHaveBeenCalledOnce();
    expect(svg.querySelectorAll('clipPath')).toHaveLength(1);
    expect(svg.querySelector(layerSelector)).toHaveAttribute('fill', '#ffffff');
  });

  it('clips transparent HTML labels over dark paint but preserves nested local background contrast', () => {
    const svg = diagram(`<rect fill="#000"/><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">
      <span>Plain</span><div style="background-color:#fff"><span class="local">Local</span></div>
    </div></foreignObject>`);
    geometry(svg, 'rect');
    geometry(svg, 'foreignObject');
    enforceMermaidSvgContrast(svg, tokens);
    const layer = svg.querySelector(layerSelector)!;
    expect(layer.querySelector('span')).toHaveStyle({ color: '#ffffff' });
    expect(layer.querySelector('.local')).toHaveStyle({ color: '#111111' });
  });

  it('uses relative geometry for transformed paint and skips unknown coordinate spaces', () => {
    const svg = diagram(`<g><rect id="dark" fill="#000"/><rect id="unknown" transform="translate(1)" fill="#000"/></g><g><text id="label">text</text></g>`);
    const shapeMatrix = { a: 1, b: 0, c: 0, d: 1, e: 10, f: 0 };
    const relative = { ...shapeMatrix, e: 5 };
    const multiply = vi.fn(() => relative);
    geometry(svg, '#dark', bounds, shapeMatrix);
    geometry(svg, '#unknown');
    geometry(svg, '#label', bounds, { ...relative, inverse: () => ({ multiply }) });
    enforceMermaidSvgContrast(svg, tokens);
    expect(multiply).toHaveBeenCalledWith(shapeMatrix);
    expect(svg.querySelector('clipPath rect')).toHaveAttribute('transform', 'matrix(1 0 0 1 5 0)');
    expect(svg.querySelectorAll(layerSelector)).toHaveLength(1);
  });

  it('uses local foreignObject backgrounds without altering embedded vector paint', () => {
    const svg = diagram(`
      <foreignObject><div xmlns="http://www.w3.org/1999/xhtml" style="background-color: #000">
        <p id="plain">light label</p>
        <div style="background-color: #fff"><span id="nested">dark label</span></div>
        <svg xmlns="http://www.w3.org/2000/svg"><path fill="red" /></svg>
      </div></foreignObject>
    `);
    enforceMermaidSvgContrast(svg, tokens);
    expect(svg.querySelector('#plain')).toHaveStyle({ color: '#ffffff' });
    expect(svg.querySelector('#nested')).toHaveStyle({ color: '#111111' });
    expect(svg.querySelector('path')).toHaveAttribute('fill', 'red');
    expect(svg.querySelectorAll(layerSelector)).toHaveLength(0);
  });

  it('uses fallback paint for unsupported geometry and removes layers in single-color mode', () => {
    const svg = diagram(`<g><rect fill="#000"/><text id="fallback">message</text><text id="sized">more</text></g>`);
    const fallback = svg.querySelector('#fallback')!;
    Object.assign(fallback, { getBBox: () => { throw new Error('not painted'); } });
    geometry(svg, 'rect');
    geometry(svg, '#sized');
    enforceMermaidSvgContrast(svg, tokens);
    expect(fallback).toHaveAttribute('fill', '#ffffff');
    expect(svg.querySelectorAll(layerSelector)).toHaveLength(1);
    enforceMermaidSvgContrast(svg, tokens, { regionAware: false });
    expect(svg.querySelector('#sized')).toHaveAttribute('fill', '#ffffff');
    expect(svg.querySelectorAll(layerSelector)).toHaveLength(0);
    expect(svg.querySelector(defsSelector)).toBeNull();
  });

  it('uses parent backgrounds and repairs nested HTML paint when no SVG geometry is requested', () => {
    const svg = diagram(`
      <g style="background-color: #000">
        <text id="label">Text<title>Tooltip</title></text>
        <foreignObject>
          <div xmlns="http://www.w3.org/1999/xhtml">
            <span id="plain">Plain</span><p style="background-color: #fff"><span id="painted">Painted</span></p>
          </div>
        </foreignObject>
      </g>
    `);
    enforceMermaidSvgContrast(svg, tokens, { regionAware: false });
    expect(svg.querySelector('#label')).toHaveAttribute('fill', '#ffffff');
    expect(svg.querySelector('title')).not.toHaveAttribute('fill');
    expect(svg.querySelector('#plain')).toHaveStyle({ color: '#ffffff' });
    expect(svg.querySelector('#painted')).toHaveStyle({ color: '#111111' });
    expect(svg.querySelector(defsSelector)).not.toBeInTheDocument();
  });

  it('falls back to local geometry when browser matrix inversion fails for untransformed sibling artwork', () => {
    const svg = diagram('<g><rect fill="#000" /><text>Text</text></g>');
    const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    geometry(svg, 'rect', bounds, matrix);
    geometry(svg, 'text', bounds, { ...matrix, inverse: () => { throw new Error('Singular matrix'); } });
    enforceMermaidSvgContrast(svg, tokens);
    const clip = svg.querySelector('clipPath rect');
    expect(clip).not.toBeNull();
    expect(clip).not.toHaveAttribute('transform');
    expect(svg.querySelector(layerSelector)).toHaveAttribute('fill', '#ffffff');
  });
});
