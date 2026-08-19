import { afterEach, describe, expect, it } from 'vitest';
import {
  captureExportThemeSnapshot,
  serializeExportThemeAttributes,
} from '../../../../ui/src/export/exportTheme';

afterEach(() => {
  for (const name of ['data-theme', 'data-theme-style', 'data-custom-theme-id']) {
    document.documentElement.removeAttribute(name);
  }
  document.documentElement.style.removeProperty('--accent');
});

describe('captureExportThemeSnapshot', () => {
  it('captures resolved root tokens and portable theme identity', () => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.themeStyle = 'raw-grid';
    document.documentElement.setAttribute('data-custom-theme-id', 'custom-one');
    document.documentElement.style.setProperty('--accent', '#123456');

    const snapshot = captureExportThemeSnapshot();

    expect(snapshot.attributes).toEqual({
      'data-theme': 'dark',
      'data-theme-style': 'raw-grid',
      'data-custom-theme-id': 'custom-one',
    });
    expect(snapshot.css).toContain('--accent:#123456;');
    expect(serializeExportThemeAttributes(snapshot)).toContain('data-theme="dark"');
  });

  it('keeps content/runtime selectors while dropping app-shell and settings rules', () => {
    const style = document.createElement('style');
    style.textContent = `
      .mdn-body h1 { color: var(--accent); }
      [data-theme-style="raw-grid"] .mdn-section { border-width: 2px; }
      .hljs-keyword { font-weight: 700; }
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

    expect(snapshot.css).toContain('.mdn-body h1');
    expect(snapshot.css).toContain('.mdn-section');
    expect(snapshot.css).toContain('.hljs-keyword');
    expect(snapshot.css).toContain('@media');
    expect(snapshot.css).toContain('.mdn-codeblock');
    expect(snapshot.css).not.toContain('.app-shell');
    expect(snapshot.css).not.toContain('html, body');
    expect(snapshot.css).not.toContain('.settings-modal');
    expect(snapshot.css).not.toContain('.sidebar');
  });
});
