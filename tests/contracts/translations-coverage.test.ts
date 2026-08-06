import { describe, expect, test } from 'vitest';
import { getTranslations, LANGUAGE_OPTIONS } from '../../ui/src/contexts/translations';
import { TRANSLATIONS } from '../../ui/src/contexts/translationsData';

function verifyObjectKeysRecursive(
  reference: Record<string, unknown>,
  target: Record<string, unknown>,
  path = '',
) {
  for (const key of Object.keys(reference)) {
    const currentPath = path ? `${path}.${key}` : key;
    expect(target, `Missing key at path: ${currentPath}`).toHaveProperty(key);

    const refValue = reference[key];
    const targetValue = target[key];

    if (typeof refValue === 'object' && refValue !== null && !Array.isArray(refValue)) {
      expect(typeof targetValue, `Path ${currentPath} should be an object`).toBe('object');
      verifyObjectKeysRecursive(
        refValue as Record<string, unknown>,
        targetValue as Record<string, unknown>,
        currentPath,
      );
    } else if (typeof refValue === 'string') {
      expect(typeof targetValue, `Path ${currentPath} should be a string`).toBe('string');
      expect((targetValue as string).trim(), `Path ${currentPath} should not be empty`).not.toBe('');
    }
  }
}

describe('translation coverage across all supported languages', () => {
  const expectedLanguages = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];

  test('LANGUAGE_OPTIONS covers all 9 expected languages', () => {
    const languageIds = LANGUAGE_OPTIONS.map((opt) => opt.id);
    expect(languageIds.sort()).toEqual([...expectedLanguages].sort());
  });

  test('all supported languages contain every translation key present in English template', () => {
    const englishTemplate = TRANSLATIONS.en as unknown as Record<string, unknown>;

    for (const lang of expectedLanguages) {
      const localeTranslations = TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Translations block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, lang);
    }
  });

  test('bookmarks.selectAll is non-empty and correctly translated in all 9 languages', () => {
    for (const lang of expectedLanguages) {
      const bookmarks = TRANSLATIONS[lang].bookmarks;
      expect(bookmarks.selectAll, `bookmarks.selectAll missing in language ${lang}`).toBeDefined();
      expect(bookmarks.selectAll.trim(), `bookmarks.selectAll in ${lang} must not be empty`).not.toBe('');
    }
  });

  test('getTranslations returns a valid complete object for all supported language codes', () => {
    for (const lang of expectedLanguages) {
      const t = getTranslations(lang);
      expect(t.bookmarks.selectAll).toBeDefined();
      expect(t.bookmarks.selectAll.trim()).not.toBe('');
      expect(t.sidebar.files).toBeDefined();
      expect(t.topbar.collapseAll).toBeDefined();
      expect(t.topbar.expandAll).toBeDefined();
      expect(t.topbar.collapseAll).not.toContain('headings');
      expect(t.topbar.expandAll).not.toContain('headings');
    }
  });
});
