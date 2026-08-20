import { afterEach, describe, expect, it } from 'vitest';
import {
  captureExportThemeSnapshot,
  renderExportThemeCss,
  serializeExportThemeAttributes,
} from '../../../../ui/src/export/exportTheme';

afterEach(() => {
  for (const name of ['data-theme', 'data-theme-style', 'data-custom-theme-id']) {
    document.documentElement.removeAttribute(name);
  }
  document.documentElement.style.removeProperty('--accent');
});

describe('captureExportThemeSnapshot', () => {
  it('captures resolved root tokens and portable theme identity as separate model fields', () => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.themeStyle = 'raw-grid';
    document.documentElement.setAttribute('data-custom-theme-id', 'custom-one');
    document.documentElement.style.setProperty('--accent', '#123456');

    const snapshot = captureExportThemeSnapshot();

    expect(snapshot.rootAttributes).toEqual({
      'data-theme': 'dark',
      'data-theme-style': 'raw-grid',
      'data-custom-theme-id': 'custom-one',
    });
    expect(snapshot.cssVariables['--accent']).toBe('#123456');
    expect(renderExportThemeCss(snapshot)).toContain('--accent:#123456;');
    expect(serializeExportThemeAttributes(snapshot)).toContain('data-theme="dark"');
  });

  it('keeps content/runtime selectors and font faces while dropping app-shell and settings rules', () => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family: "Export Test"; src: local("Export Test"); }
      .mdn-body h1 { color: var(--accent); }
      [data-theme-style="raw-grid"] .mdn-section { border-width: 2px; }
      .hljs-keyword { font-weight: 700; }
      .hl-kw { color: red; }
      .app-shell { overflow: hidden; }
      html, body { height: 100%; overflow: hidden; }
      [data-theme-style="raw-grid"] .settings-modal { color: red; }
      @media (max-width: 700px) {
        .mdn-codeblock { max-width: 100%; }
        .sidebar { display: none; }
      }
    `;
    document.head.appendChild(style);

    const snapshot = captureExportThemeSnapshot();

    expect(snapshot.fontFaceCss).toContain('@font-face');
    expect(snapshot.fontFaceCss).toContain('Export Test');
    expect(snapshot.cssText).toContain('.mdn-body h1');
    expect(snapshot.cssText).toContain('.mdn-section');
    expect(snapshot.cssText).toContain('.hljs-keyword');
    expect(snapshot.cssText).toContain('.hl-kw');
    expect(snapshot.cssText).toContain('@media');
    expect(snapshot.cssText).toContain('.mdn-codeblock');
    expect(snapshot.cssText).not.toContain('.app-shell');
    expect(snapshot.cssText).not.toContain('html, body');
    expect(snapshot.cssText).not.toContain('.settings-modal');
    expect(snapshot.cssText).not.toContain('.sidebar');
  });
});
