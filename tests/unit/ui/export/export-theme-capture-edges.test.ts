import { afterEach, describe, expect, it } from 'vitest';
import { captureExportThemeSnapshot, renderExportThemeCss, serializeExportThemeAttributes } from '../../../../ui/src/export/exportTheme';

afterEach(() => { document.head.innerHTML = ''; document.documentElement.removeAttribute('style'); document.documentElement.removeAttribute('data-theme'); });

describe('export theme capture edges', () => {
  it('filters font faces, keyframes, grouped and non-portable rules', () => {
    const style = document.createElement('style');
    style.textContent = `@font-face{font-family:X;src:url(x.woff)}
      @keyframes spin{from{opacity:0}to{opacity:1}}
      @media screen{.mdn-body{color:red}.other{color:blue}}
      @media print{.other{color:blue}}
      .mdn-body p{margin:0}
      .unrelated{color:green}`;
    document.head.append(style);
    document.documentElement.setAttribute('data-theme', 'a"<b>&');
    document.documentElement.style.setProperty('--x', ' 1 ');
    document.documentElement.style.setProperty('--empty', ' ');
    const snap = captureExportThemeSnapshot();
    expect(snap.fontFaceCss).toContain('@font-face');
    expect(snap.cssText).toContain('keyframes');
    expect(snap.cssText).not.toContain('.unrelated');
    expect(snap.cssText).not.toContain('@media print');
    expect(snap.cssVariables['--x']).toBe('1');
    expect(serializeExportThemeAttributes(snap)).toContain('&quot;&lt;b&gt;&amp;');
    expect(renderExportThemeCss({ rootAttributes: {}, cssVariables: {}, cssText: '', fontFaceCss: '' })).toBe(':root{}');
  });
});
