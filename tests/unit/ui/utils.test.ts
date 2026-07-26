import { describe, expect, test } from 'vitest';

import {
  buildShortcutTooltip,
  createToolbarMenuItems,
  formatToolbarShortcutLabel,
} from '../../../ui/src/utils/toolbar-menu.js';

import { formatShortcutLabel } from '../../../ui/src/utils/shortcuts';
import {
  normalizeForSearch,
  prepareHaystack,
  unicodeFindAll,
  unicodeIndexOf,
} from '../../../ui/src/utils/unicodeSearch';

describe('toolbar-menu', () => {
  test('buildShortcutTooltip appends shortcut label to tooltip copy', () => {
    expect(buildShortcutTooltip('Toggle Sidebar', 'Ctrl+b')).toBe('Toggle Sidebar - (Ctrl+B)');
  });

  test('buildShortcutTooltip leaves tooltip unchanged when no shortcut exists', () => {
    expect(buildShortcutTooltip('Open current file in editor', '')).toBe('Open current file in editor');
  });

  test('createToolbarMenuItems returns the requested button order', () => {
    const items = createToolbarMenuItems({
      labels: { home: 'Home', theme: 'Theme', edit: 'Edit', settings: 'Settings' },
      tooltips: { home: 'Welcome Page', theme: 'Toggle light/dark mode', edit: 'Open current file in editor', settings: 'Settings - update available' },
      shortcuts: { home: 'Ctrl+H', theme: 'Ctrl+L', settings: 'Ctrl+I' },
      canEdit: false,
    });

    expect(items.map((item: any) => ({ id: item.id, label: item.label, disabled: item.disabled, tooltip: item.tooltip }))).toEqual([
      { id: 'home', label: 'Home', disabled: false, tooltip: 'Welcome Page - (Ctrl+H)' },
      { id: 'theme', label: 'Theme', disabled: false, tooltip: 'Toggle light/dark mode - (Ctrl+L)' },
      { id: 'edit', label: 'Edit', disabled: true, tooltip: 'Open current file in editor' },
      { id: 'settings', label: 'Settings', disabled: false, tooltip: 'Settings - update available - (Ctrl+I)' },
    ]);
  });

  test('buildShortcutTooltip uppercases lowercase single-letter shortcut keys', () => {
    expect(buildShortcutTooltip('Expand All', 'ctrl+shift+x')).toBe('Expand All - (ctrl+shift+X)');
  });

  test('formatToolbarShortcutLabel with empty string', () => {
    expect(formatToolbarShortcutLabel('')).toBe('');
  });

  test('formatToolbarShortcutLabel with null input', () => {
    expect(formatToolbarShortcutLabel(null as any)).toBe('');
  });

  test('formatToolbarShortcutLabel with multiple single chars', () => {
    expect(formatToolbarShortcutLabel('a+b+c')).toBe('A+B+C');
  });
});

describe('formatShortcutLabel', () => {
  test('splits on +, uppercases single chars', () => {
    expect(formatShortcutLabel('Ctrl+k')).toBe('Ctrl+K');
  });

  test('custom joiner', () => {
    expect(formatShortcutLabel('Ctrl+Shift+f', ' ')).toBe('Ctrl Shift F');
  });

  test('multiple single chars uppercased', () => {
    expect(formatShortcutLabel('a+b+c')).toBe('A+B+C');
  });

  test('left and right arrows use compact glyphs', () => {
    expect(formatShortcutLabel('Ctrl+ArrowLeft')).toBe('Ctrl+←');
    expect(formatShortcutLabel('Alt+ArrowRight')).toBe('Alt+→');
  });

  test('empty parts filtered', () => {
    expect(formatShortcutLabel('Ctrl++k')).toBe('Ctrl+K');
  });
});

describe('unicodeSearch', () => {
  describe('normalizeForSearch', () => {
    test('basic lowercase normalization', () => {
      expect(normalizeForSearch('Hello')).toBe('hello');
    });

    test('NFC normalization: composed e + combining accent', () => {
      const decomposed = 'e\u0301';
      const composed = '\u00e9';
      expect(normalizeForSearch(decomposed)).toBe(normalizeForSearch(composed));
    });

    test('Turkish İ normalization', () => {
      const result = normalizeForSearch('\u0130stanbul');
      expect(result).toBe('istanbul');
    });

    test('German ß normalization', () => {
      const lower = normalizeForSearch('straße');
      const upper = normalizeForSearch('STRASSE');
      expect(lower).toBe(upper);
    });
  });

  describe('unicodeIndexOf', () => {
    test('finds simple match', () => {
      const result = unicodeIndexOf('Hello World', 'world');
      expect(result).not.toBeNull();
      expect(result!.index).toBe(6);
    });

    test('returns null for empty needle', () => {
      expect(unicodeIndexOf('text', '')).toBeNull();
    });

    test('returns null when not found', () => {
      expect(unicodeIndexOf('abc', 'xyz')).toBeNull();
    });

    test('Turkish İ matches lowercase i', () => {
      const result = unicodeIndexOf('\u0130stanbul', 'istanbul');
      expect(result).not.toBeNull();
      expect(result!.index).toBe(0);
    });

    test('NFC vs NFD match', () => {
      const composed = '\u00e9cole';
      const decomposed = 'e\u0301cole';
      const result = unicodeIndexOf(composed, decomposed);
      expect(result).not.toBeNull();
    });

    test('fromIndex parameter', () => {
      const result = unicodeIndexOf('abcabc', 'abc', 1);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(3);
    });
  });

  describe('unicodeFindAll', () => {
    test('finds all occurrences', () => {
      const results = unicodeFindAll('abcabc', 'abc');
      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(3);
    });

    test('returns empty for empty needle', () => {
      expect(unicodeFindAll('text', '')).toEqual([]);
    });

    test('returns empty for empty text', () => {
      expect(unicodeFindAll('', 'abc')).toEqual([]);
    });

    test('respects maxResults', () => {
      const results = unicodeFindAll('abcabcabc', 'abc', 2);
      expect(results).toHaveLength(2);
    });

    test('case-insensitive Unicode finds', () => {
      const results = unicodeFindAll('Straße STRASSE', 'straße');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('prepareHaystack', () => {
    test('indexOf finds match in pre-normalized haystack', () => {
      const haystack = prepareHaystack('Hello World');
      const result = haystack.indexOf('world');
      expect(result).not.toBeNull();
      expect(result!.index).toBe(6);
    });

    test('indexOf returns null for not found', () => {
      const haystack = prepareHaystack('abc');
      expect(haystack.indexOf('xyz')).toBeNull();
    });

    test('indexOfNormalized returns match and next position', () => {
      const haystack = prepareHaystack('abcabc');
      const result = haystack.indexOfNormalized('abc');
      expect(result).not.toBeNull();
      expect(result!.match.index).toBe(0);
      expect(result!.nextNormIndex).toBe(3);
    });

    test('indexOfNormalized returns null for not found', () => {
      const haystack = prepareHaystack('abc');
      expect(haystack.indexOfNormalized('xyz')).toBeNull();
    });

    test('indexOf returns null for empty normNeedle', () => {
      const haystack = prepareHaystack('abc');
      expect(haystack.indexOf('')).toBeNull();
    });

    test('indexOf with fromIndex > 0', () => {
      const haystack = prepareHaystack('abcabc');
      const result = haystack.indexOf('abc', 1);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(3);
    });

    test('indexOfNormalized iterates through matches', () => {
      const haystack = prepareHaystack('abcabc');
      const first = haystack.indexOfNormalized('abc');
      expect(first).not.toBeNull();
      const second = haystack.indexOfNormalized('abc', first!.nextNormIndex);
      expect(second).not.toBeNull();
      expect(second!.match.index).toBe(3);
    });
  });

  describe('unicodeIndexOf edge cases', () => {
    test('fromIndex beyond text length returns null', () => {
      expect(unicodeIndexOf('abc', 'abc', 10)).toBeNull();
    });

    test('fromIndex at boundary finds match starting at that index', () => {
      expect(unicodeIndexOf('ab', 'ab', 0)!.index).toBe(0);
    });

    test('empty text returns null', () => {
      expect(unicodeIndexOf('', 'abc')).toBeNull();
    });

    test('needle longer than text returns null', () => {
      expect(unicodeIndexOf('ab', 'abc')).toBeNull();
    });

    test('normNeedle empty returns null', () => {
      expect(unicodeIndexOf('\u0130', '\u0307')).toBeNull();
    });
  });

  describe('unicodeFindAll edge cases', () => {
    test('returns empty when needle normalized is empty', () => {
      expect(unicodeFindAll('text', '\u0307')).toEqual([]);
    });

    test('maxResults = 0 returns empty', () => {
      expect(unicodeFindAll('abcabc', 'abc', 0)).toEqual([]);
    });

    test('finds single occurrence', () => {
      const results = unicodeFindAll('abc', 'abc');
      expect(results).toHaveLength(1);
      expect(results[0].index).toBe(0);
    });
  });
});
