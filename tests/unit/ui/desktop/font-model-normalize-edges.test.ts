import { describe, expect, it } from 'vitest';
import { DEFAULT_DESKTOP_FONT_BINDINGS, getDesktopFontVariantOptions, normalizeDesktopFontBinding, normalizeDesktopFontSelection } from '../../../../ui/src/desktop/fonts/fontModel';

describe('desktop font model normalisation edges', () => {
  it('rejects malformed selections and bindings', () => {
    expect(normalizeDesktopFontSelection({ source: 'system', family: 42 })).toEqual({ source: 'default' });
    expect(normalizeDesktopFontSelection({ source: 'system', family: '   ' })).toEqual({ source: 'default' });
    expect(normalizeDesktopFontSelection({ source: 'imported', family: 'F', id: 'bad id!' })).toEqual({ source: 'default' });
    expect(normalizeDesktopFontBinding({ source: 'bogus' }, 'body')).toEqual(DEFAULT_DESKTOP_FONT_BINDINGS.body);
    const binding = normalizeDesktopFontBinding({ source: 'system', family: 'Inter', style: 'normal', weight: 'heavy', size: 'x' }, 'code');
    expect(binding).toMatchObject({ source: 'system', style: 'normal', weight: DEFAULT_DESKTOP_FONT_BINDINGS.code.weight });
    expect(normalizeDesktopFontBinding({ source: 'default', style: 'italic', weight: '500', size: 14 }, 'quote')).toMatchObject({ style: 'italic', weight: 500, size: 14 });
  });

  it('sorts normal before italic variants and limits variable weights to the face range', () => {
    const options = getDesktopFontVariantOptions({
      available: true,
      faces: [
        { style: 'italic', minWeight: 400, maxWeight: 400, variable: false },
        { style: 'normal', minWeight: 350, maxWeight: 650, variable: true },
        { style: 'normal', minWeight: 400, maxWeight: 400, variable: false },
      ],
    } as any);
    expect(options[0].style).toBe('normal');
    expect(options.at(-1)!.style).toBe('italic');
    expect(options.filter((o) => o.style === 'normal').map((o) => o.weight)).toEqual([350, 400, 500, 600, 650]);
  });
});
