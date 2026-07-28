import { afterEach, describe, expect, test, vi } from 'vitest';

import { normalizeThemeMode, normalizeThemeStyle } from '../../../ui/src/contexts/appStateConstants';

import {
  CUSTOM_THEME_COLOR_OPTIONS,
  MAX_BACKGROUND_DATA_URL_LENGTH,
  MAX_CUSTOM_THEMES,
  applyCustomThemeToRoot,
  getActiveCustomTheme,
  normalizeActiveCustomThemeId,
  normalizeCustomThemes,
} from '../../../ui/src/theme/customThemes';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-custom-theme-id');
});

const VALID_DATA_URL = 'data:image/png;base64,iVBOR';
const OVERSIZED_DATA_URL = `data:image/png;base64,${'x'.repeat(MAX_BACKGROUND_DATA_URL_LENGTH)}`;
const NON_IMAGE_DATA_URL = 'data:text/plain;base64,abc';

describe('MAX_CUSTOM_THEMES', () => {
  test('equals 24', () => {
    expect(MAX_CUSTOM_THEMES).toBe(24);
  });
});

describe('MAX_BACKGROUND_DATA_URL_LENGTH', () => {
  test('equals 900_000', () => {
    expect(MAX_BACKGROUND_DATA_URL_LENGTH).toBe(900_000);
  });
});

describe('CUSTOM_THEME_COLOR_OPTIONS', () => {
  test('has 20 entries with key/label/cssVar', () => {
    expect(CUSTOM_THEME_COLOR_OPTIONS).toHaveLength(20);
    for (const opt of CUSTOM_THEME_COLOR_OPTIONS) {
      expect(typeof opt.key).toBe('string');
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.cssVar).toBe('string');
    }
  });
});

describe('normalizeCustomThemes', () => {
  const now = Date.now();

  test('non-array returns []', () => {
    expect(normalizeCustomThemes('nope')).toEqual([]);
    expect(normalizeCustomThemes(null)).toEqual([]);
    expect(normalizeCustomThemes(42)).toEqual([]);
  });

  test('empty array returns []', () => {
    expect(normalizeCustomThemes([])).toEqual([]);
  });

  test('non-object item filtered', () => {
    expect(normalizeCustomThemes([42, 'x', null, true])).toEqual([]);
  });

  test('missing id filtered', () => {
    expect(normalizeCustomThemes([{ name: 'no-id' }])).toEqual([]);
  });

  test('empty id after trim filtered', () => {
    expect(normalizeCustomThemes([{ id: '   ', name: 'blank-id' }])).toEqual([]);
  });

  test('duplicate id: only first kept', () => {
    const input = [
      { id: 'dup', name: 'First' },
      { id: 'dup', name: 'Second' },
    ];
    const result = normalizeCustomThemes(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('First');
  });

  test('name defaults to Custom theme', () => {
    const result = normalizeCustomThemes([{ id: 'a' }]);
    expect(result[0].name).toBe('Custom theme');
  });

  test('name trimmed and sliced to 48', () => {
    const long = 'b'.repeat(100);
    const result = normalizeCustomThemes([{ id: 'a', name: `  ${long}  ` }]);
    expect(result[0].name).toBe('b'.repeat(48));
  });

  test('baseStyle normalized via normalizeThemeStyle', () => {
    const result = normalizeCustomThemes([{ id: 'a', baseStyle: 'glass' }]);
    expect(result[0].baseStyle).toBe('glass');
    expect(normalizeCustomThemes([{ id: 'neon', baseStyle: 'neon-voltage' }])[0].baseStyle).toBe('neon-voltage');
    expect(normalizeCustomThemes([{ id: 'raw', baseStyle: 'raw-grid' }])[0].baseStyle).toBe('raw-grid');
    const result2 = normalizeCustomThemes([{ id: 'a', baseStyle: 'invalid' }]);
    expect(result2[0].baseStyle).toBe('default');
  });

  test('colorMode normalized via normalizeThemeMode', () => {
    const result = normalizeCustomThemes([{ id: 'a', colorMode: 'dark' }]);
    expect(result[0].colorMode).toBe('dark');
    const result2 = normalizeCustomThemes([{ id: 'a', colorMode: 'invalid' }]);
    expect(result2[0].colorMode).toBe('auto');
  });

  test('createdAt/updatedAt clamped to [0, now]', () => {
    const fixedNow = 100000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    const result = normalizeCustomThemes([{ id: 'a', createdAt: -10, updatedAt: fixedNow + 999999 }]);
    expect(result[0].createdAt).toBe(0);
    expect(result[0].updatedAt).toBe(fixedNow);
    vi.restoreAllMocks();
  });

  test('createdAt/updatedAt default to now when not finite', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const result = normalizeCustomThemes([{ id: 'a', createdAt: NaN, updatedAt: Infinity }]);
    expect(result[0].createdAt).toBe(now);
    expect(result[0].updatedAt).toBe(now);
    vi.restoreAllMocks();
  });

  test('colors: dark overrides normalized', () => {
    const result = normalizeCustomThemes([{
      id: 'a',
      colors: { dark: { bg: '#111111', text: '#EEEEEE' } },
    }]);
    expect(result[0].colors?.dark).toEqual({ bg: '#111111', text: '#eeeeee' });
    expect(result[0].colors?.light).toBeUndefined();
  });

  test('colors: light overrides normalized', () => {
    const result = normalizeCustomThemes([{
      id: 'a',
      colors: { light: { bg: '#ffffff' } },
    }]);
    expect(result[0].colors?.light).toEqual({ bg: '#ffffff' });
    expect(result[0].colors?.dark).toBeUndefined();
  });

  test('colors: only present if either has valid hex', () => {
    const result = normalizeCustomThemes([{
      id: 'a',
      colors: { dark: { bg: 'invalid' } },
    }]);
    expect(result[0].colors).toBeUndefined();
  });

  test('layout: density normalized (compact/spacious/comfortable)', () => {
    for (const [input, expected] of [['compact', 'compact'], ['spacious', 'spacious'], ['other', 'comfortable'], [undefined, 'comfortable']] as const) {
      const result = normalizeCustomThemes([{ id: 'a', layout: { density: input as any } }]);
      expect(result[0].layout?.density).toBe(expected);
    }
  });

  test('layout: radius clamped [0,18]', () => {
    expect(normalizeCustomThemes([{ id: 'a', layout: { radius: -5 } }])[0].layout?.radius).toBe(0);
    expect(normalizeCustomThemes([{ id: 'a', layout: { radius: 25 } }])[0].layout?.radius).toBe(18);
    expect(normalizeCustomThemes([{ id: 'a', layout: { radius: 8 } }])[0].layout?.radius).toBe(8);
  });

  test('layout: strokeWidth clamped [0,3]', () => {
    expect(normalizeCustomThemes([{ id: 'a', layout: { strokeWidth: -1 } }])[0].layout?.strokeWidth).toBe(0);
    expect(normalizeCustomThemes([{ id: 'a', layout: { strokeWidth: 10 } }])[0].layout?.strokeWidth).toBe(3);
  });

  test('layout: contentPadding clamped [16,64]', () => {
    expect(normalizeCustomThemes([{ id: 'a', layout: { contentPadding: 5 } }])[0].layout?.contentPadding).toBe(16);
    expect(normalizeCustomThemes([{ id: 'a', layout: { contentPadding: 100 } }])[0].layout?.contentPadding).toBe(64);
  });

  test('layout: sectionGap clamped [4,28]', () => {
    expect(normalizeCustomThemes([{ id: 'a', layout: { sectionGap: 0 } }])[0].layout?.sectionGap).toBe(4);
    expect(normalizeCustomThemes([{ id: 'a', layout: { sectionGap: 50 } }])[0].layout?.sectionGap).toBe(28);
  });

  test('caps at 24 entries', () => {
    const input = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}` }));
    expect(normalizeCustomThemes(input)).toHaveLength(24);
  });

  test('background: type image with valid data URL kept', () => {
    const result = normalizeCustomThemes([{
      id: 'a',
      background: { type: 'image', imageDataUrl: VALID_DATA_URL },
    }]);
    expect(result[0].background?.type).toBe('image');
    expect(result[0].background?.imageDataUrl).toBe(VALID_DATA_URL);
  });

  test('background: oversized data URL → type none', () => {
    const result = normalizeCustomThemes([{
      id: 'a',
      background: { type: 'image', imageDataUrl: OVERSIZED_DATA_URL },
    }]);
    expect(result[0].background?.type).toBe('none');
    expect(result[0].background?.imageDataUrl).toBeUndefined();
  });

  test('background: non-image data URL → type none', () => {
    const result = normalizeCustomThemes([{
      id: 'a',
      background: { type: 'image', imageDataUrl: NON_IMAGE_DATA_URL },
    }]);
    expect(result[0].background?.type).toBe('none');
  });

  test('background: opacity clamped [0, 0.5], default 0.16', () => {
    const r1 = normalizeCustomThemes([{ id: 'a', background: { opacity: -1 } }]);
    expect(r1[0].background?.opacity).toBe(0);
    const r2 = normalizeCustomThemes([{ id: 'a', background: { opacity: 1 } }]);
    expect(r2[0].background?.opacity).toBe(0.5);
    const r3 = normalizeCustomThemes([{ id: 'a', background: {} }]);
    expect(r3[0].background?.opacity).toBe(0.16);
  });

  test('background: fit non-contain → cover', () => {
    const r = normalizeCustomThemes([{ id: 'a', background: { fit: 'stretch' } }]);
    expect(r[0].background?.fit).toBe('cover');
    const r2 = normalizeCustomThemes([{ id: 'a', background: { fit: 'contain' } }]);
    expect(r2[0].background?.fit).toBe('contain');
  });

  test('background: position trimmed and sliced to 48, default center', () => {
    const long = 'p'.repeat(100);
    const r1 = normalizeCustomThemes([{ id: 'a', background: { position: `  ${long}  ` } }]);
    expect(r1[0].background?.position).toBe('p'.repeat(48));
    const r2 = normalizeCustomThemes([{ id: 'a', background: { position: '' } }]);
    expect(r2[0].background?.position).toBe('center');
  });

  test('background: blur clamped [0, 18], default 0', () => {
    const r1 = normalizeCustomThemes([{ id: 'a', background: { blur: -5 } }]);
    expect(r1[0].background?.blur).toBe(0);
    const r2 = normalizeCustomThemes([{ id: 'a', background: { blur: 30 } }]);
    expect(r2[0].background?.blur).toBe(18);
    const r3 = normalizeCustomThemes([{ id: 'a', background: { type: 'none' } }]);
    expect(r3[0].background?.blur).toBe(0);
  });
});

describe('normalizeActiveCustomThemeId', () => {
  const themes = normalizeCustomThemes([{ id: 'foo' }, { id: 'bar' }]);

  test('string matching existing theme ID returns value', () => {
    expect(normalizeActiveCustomThemeId('foo', themes)).toBe('foo');
  });

  test('string not matching returns undefined', () => {
    expect(normalizeActiveCustomThemeId('missing', themes)).toBeUndefined();
  });

  test('non-string returns undefined', () => {
    expect(normalizeActiveCustomThemeId(42, themes)).toBeUndefined();
    expect(normalizeActiveCustomThemeId(null, themes)).toBeUndefined();
  });
});

describe('getActiveCustomTheme', () => {
  const themeA = { id: 'a', name: 'A', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1 };
  const themeB = { id: 'b', name: 'B', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1 };

  test('activeCustomThemeId set and found returns theme', () => {
    const settings = { customThemes: [themeA, themeB], activeCustomThemeId: 'a' } as any;
    expect(getActiveCustomTheme(settings)).toEqual(themeA);
  });

  test('activeCustomThemeId set but not found returns undefined', () => {
    const settings = { customThemes: [themeA], activeCustomThemeId: 'z' } as any;
    expect(getActiveCustomTheme(settings)).toBeUndefined();
  });

  test('activeCustomThemeId undefined returns undefined', () => {
    const settings = { customThemes: [themeA] } as any;
    expect(getActiveCustomTheme(settings)).toBeUndefined();
  });
});

describe('applyCustomThemeToRoot', () => {
  const root = document.documentElement;

  test('no theme clears all custom CSS vars, removes data-custom-theme-id', () => {
    root.dataset.customThemeId = 'old';
    root.style.setProperty('--bg', '#111');
    applyCustomThemeToRoot(root, undefined, 'dark');
    expect(root.getAttribute('data-custom-theme-id')).toBeNull();
    expect(root.style.getPropertyValue('--bg')).toBe('');
  });

  test('sets data-custom-theme-id', () => {
    const theme = { id: 'my-theme', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1, colorMode: 'dark' as const };
    applyCustomThemeToRoot(root, theme, 'auto');
    expect(root.dataset.customThemeId).toBe('my-theme');
  });

  test('applies dark color overrides when colorMode is dark', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1, colorMode: 'dark' as const,
      colors: { dark: { bg: '#1a1a1a', text: '#e0e0e0', accent: '#ff0000', border: '#555555', code: '#2a2a2a' } },
    };
    applyCustomThemeToRoot(root, theme, 'auto');
    expect(root.style.getPropertyValue('--bg')).toBe('#1a1a1a');
    expect(root.style.getPropertyValue('--tx')).toBe('#e0e0e0');
    expect(root.style.getPropertyValue('--accent')).toBe('#ff0000');
    expect(root.style.getPropertyValue('--bd')).toBe('#55555555');
    expect(root.style.getPropertyValue('--accent-dim')).toBe('#ff000026');
    expect(root.style.getPropertyValue('--inline-code-bg')).toBeTruthy();
  });

  test('applies light color overrides when colorMode is light', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1, colorMode: 'light' as const,
      colors: { light: { bg: '#ffffff', text: '#000000' } },
    };
    applyCustomThemeToRoot(root, theme, 'auto');
    expect(root.style.getPropertyValue('--bg')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--tx')).toBe('#000000');
  });

  test('themeMode overrides colorMode when colorMode is undefined', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      colors: { dark: { bg: '#111111' }, light: { bg: '#ffffff' } },
    };
    applyCustomThemeToRoot(root, theme, 'light');
    expect(root.style.getPropertyValue('--bg')).toBe('#ffffff');
  });

  test('auto mode with matchMedia dark resolves to dark', () => {
    const mq = { matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => mq);
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      colors: { dark: { bg: '#111111' }, light: { bg: '#ffffff' } },
    };
    applyCustomThemeToRoot(root, theme, 'auto');
    expect(root.style.getPropertyValue('--bg')).toBe('#111111');
    vi.restoreAllMocks();
  });

  test('auto mode with matchMedia light resolves to light', () => {
    const mq = { matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => mq);
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      colors: { dark: { bg: '#111111' }, light: { bg: '#ffffff' } },
    };
    applyCustomThemeToRoot(root, theme, 'auto');
    expect(root.style.getPropertyValue('--bg')).toBe('#ffffff');
    vi.restoreAllMocks();
  });

  test('applies layout: density tokens and radius', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      layout: { density: 'compact' as const, radius: 8, contentPadding: 30 },
    };
    applyCustomThemeToRoot(root, theme, 'dark');
    expect(root.style.getPropertyValue('--topbar-h')).toBe('44px');
    expect(root.style.getPropertyValue('--r')).toBe('8px');
    expect(root.style.getPropertyValue('--r-md')).toBe('8px');
    expect(root.style.getPropertyValue('--r-lg')).toBe('8px');
    expect(root.style.getPropertyValue('--content-pad-y')).toBeTruthy();
  });

  test('applies layout: spacious density tokens', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      layout: { density: 'spacious' as const },
    };
    applyCustomThemeToRoot(root, theme, 'dark');
    expect(root.style.getPropertyValue('--topbar-h')).toBe('52px');
  });

  test('applies layout: radius < 4 still sets --r-md to 4px minimum', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      layout: { radius: 2 },
    };
    applyCustomThemeToRoot(root, theme, 'dark');
    expect(root.style.getPropertyValue('--r-md')).toBe('4px');
    expect(root.style.getPropertyValue('--r-lg')).toBe('6px');
  });

  test('applies background: image type sets CSS vars', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      background: { type: 'image' as const, imageDataUrl: VALID_DATA_URL, opacity: 0.3, fit: 'contain' as const, position: 'top left', blur: 5 },
    };
    applyCustomThemeToRoot(root, theme, 'dark');
    expect(root.style.getPropertyValue('--custom-theme-bg-image')).toContain(VALID_DATA_URL);
    expect(root.style.getPropertyValue('--custom-theme-bg-opacity')).toBe('0.3');
    expect(root.style.getPropertyValue('--custom-theme-bg-fit')).toBe('contain');
    expect(root.style.getPropertyValue('--custom-theme-bg-position')).toBe('top left');
    expect(root.style.getPropertyValue('--custom-theme-bg-blur')).toBe('5px');
  });

  test('background: none type → no background vars', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1,
      background: { type: 'none' as const },
    };
    applyCustomThemeToRoot(root, theme, 'dark');
    expect(root.style.getPropertyValue('--custom-theme-bg-image')).toBe('');
  });

  test('clearing a theme (undefined) removes all custom vars', () => {
    const theme = {
      id: 't', name: 'T', baseStyle: 'default' as const, createdAt: 1, updatedAt: 1, colorMode: 'dark' as const,
      colors: { dark: { bg: '#111111' } },
      layout: { density: 'compact' as const, radius: 10 },
      background: { type: 'image' as const, imageDataUrl: VALID_DATA_URL, opacity: 0.2, fit: 'cover' as const, position: 'center', blur: 3 },
    };
    applyCustomThemeToRoot(root, theme, 'dark');
    expect(root.style.getPropertyValue('--bg')).toBeTruthy();
    expect(root.style.getPropertyValue('--r')).toBeTruthy();
    expect(root.style.getPropertyValue('--custom-theme-bg-image')).toBeTruthy();

    applyCustomThemeToRoot(root, undefined, 'dark');
    expect(root.style.getPropertyValue('--bg')).toBe('');
    expect(root.style.getPropertyValue('--r')).toBe('');
    expect(root.style.getPropertyValue('--custom-theme-bg-image')).toBe('');
    expect(root.getAttribute('data-custom-theme-id')).toBeNull();
  });
});
