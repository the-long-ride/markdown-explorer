import { afterEach, describe, expect, it } from 'vitest';
import { captureExportThemeSnapshot, renderExportThemeCss, serializeExportThemeAttributes } from '../../../../ui/src/export/exportTheme';

afterEach(() => { document.head.innerHTML = ''; document.documentElement.removeAttribute('style'); });

describe('captureExportThemeSnapshot rule handling', () => {
  it('keeps keyframes, nested media rules and inline css variables', () => {
    const style = document.createElement('style');
    style.textContent = '@keyframes spin{from{opacity:0}to{opacity:1}} @media print{.a{color:red}} @media screen{} @font-face{font-family:X;src:url(x.woff)} .b{color:blue}';
    document.head.appendChild(style);
    document.documentElement.setAttribute('style', '--accent: #f00; --empty: ; color: red');
    document.documentElement.setAttribute('data-theme', 'a"<b>&');
    const snapshot = captureExportThemeSnapshot();
    expect(snapshot.cssText).toContain('keyframes');
    expect(snapshot.cssVariables['--accent']).toBe('#f00');
    expect(serializeExportThemeAttributes(snapshot)).toContain('&quot;');
    expect(renderExportThemeCss(snapshot)).toContain('--accent');
  });

  it('captures from an explicit root element', () => {
    const root = document.createElement('div');
    root.style.setProperty('--x', '1px');
    expect(captureExportThemeSnapshot(root).cssVariables['--x']).toBe('1px');
  });
});
