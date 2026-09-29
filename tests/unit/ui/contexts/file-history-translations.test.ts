import { describe, expect, it } from 'vitest';
import { FILE_HISTORY_TRANSLATIONS, getFileHistoryTranslations } from '../../../../ui/src/contexts/fileHistoryTranslations';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';

describe('file history translations', () => {
  it('defines every label for every supported language', () => {
    const englishKeys = Object.keys(FILE_HISTORY_TRANSLATIONS.en).sort();
    for (const { id } of LANGUAGE_OPTIONS) {
      expect(Object.keys(FILE_HISTORY_TRANSLATIONS[id]).sort(), id).toEqual(englishKeys);
      for (const key of englishKeys) {
        expect(FILE_HISTORY_TRANSLATIONS[id][key as keyof typeof FILE_HISTORY_TRANSLATIONS.en].trim(), `${id}.${key}`).not.toBe('');
      }
      expect(FILE_HISTORY_TRANSLATIONS[id].renamedFrom, id).toContain('{path}');
    }
  });

  it('falls back to English for unknown languages', () => {
    expect(getFileHistoryTranslations('xx')).toBe(FILE_HISTORY_TRANSLATIONS.en);
  });
});
