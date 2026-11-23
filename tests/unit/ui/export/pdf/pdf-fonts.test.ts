import { describe, expect, it } from 'vitest';
import { preparePdfFonts } from '../../../../../ui/src/export/pdf/pdfFonts';

const face = (family: string | null, src: string, extra = '') =>
  `@font-face { ${family === null ? '' : `font-family: ${family};`} src: ${src}; ${extra} }`;
const data = (mime: string) => `url(data:${mime};charset=utf-8;base64,QUJD)`;

describe('preparePdfFonts', () => {
  it('falls back to Roboto without font faces', () => {
    expect(preparePdfFonts({ fontFaceCss: '', cssVariables: {} } as any)).toEqual({ defaultFont: 'Roboto', vfs: {}, fonts: {}, warnings: [] });
  });

  it('embeds base64 font faces and maps weights and styles', () => {
    const css = [
      face("'Inter', sans-serif", data('font/woff2')),
      face('"Inter"', data('font/woff'), 'font-weight: 700;'),
      face('Inter', data('font/otf'), 'font-style: italic;'),
      face('Inter', data('application/x-font-opentype'), 'font-style: italic; font-weight: 600;'),
      face('Mono', data('font/ttf'), 'font-weight: 800;'),
      face('Serif', data('font/ttf'), 'font-style: italic; font-weight: 700;'),
      face('Slant', data('font/ttf'), 'font-style: italic;'),
      face('Remote', 'url(https://fonts.test/remote.woff2)'),
      face(null, data('font/woff2')),
      face("''", data('font/woff2')),
    ].join('\n');
    const bundle = preparePdfFonts({ fontFaceCss: css, cssVariables: { '--font-body': '"Inter", system-ui' } } as any);
    expect(bundle.defaultFont).toBe('Inter');
    expect(Object.keys(bundle.vfs)).toEqual(expect.arrayContaining(['mdn-pdf-font-1.woff2', 'mdn-pdf-font-2.woff', 'mdn-pdf-font-3.otf', 'mdn-pdf-font-4.otf', 'mdn-pdf-font-5.ttf']));
    expect(bundle.fonts.Inter).toEqual({ normal: 'mdn-pdf-font-1.woff2', bold: 'mdn-pdf-font-2.woff', italics: 'mdn-pdf-font-3.otf', bolditalics: 'mdn-pdf-font-4.otf' });
    expect(bundle.fonts.Mono).toEqual({ normal: 'mdn-pdf-font-5.ttf', bold: 'mdn-pdf-font-5.ttf', italics: 'mdn-pdf-font-5.ttf', bolditalics: 'mdn-pdf-font-5.ttf' });
    expect(bundle.fonts.Serif.bolditalics).toBe('mdn-pdf-font-6.ttf');
    expect(bundle.fonts.Slant.italics).toBe('mdn-pdf-font-7.ttf');
    expect(bundle.warnings).toEqual(['Custom PDF font "Remote" is not embedded/readable; using Roboto when necessary.']);
  });

  it('keeps Roboto when the body font is not embedded', () => {
    const bundle = preparePdfFonts({ fontFaceCss: face('Mono', data('font/ttf')), cssVariables: { '--font-body': 'Georgia' } } as any);
    expect(bundle.defaultFont).toBe('Roboto');
  });
});
