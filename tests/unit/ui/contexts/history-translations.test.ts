import { describe, expect, it } from 'vitest';
import { HISTORY_TRANSLATIONS } from '../../../../ui/src/contexts/historyTranslations';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';

describe('history translations', () => {
  it('defines every history and diff label for every supported language', () => {
    const englishKeys = Object.keys(HISTORY_TRANSLATIONS.en).sort();
    for (const { id } of LANGUAGE_OPTIONS) {
      expect(Object.keys(HISTORY_TRANSLATIONS[id]).sort(), id).toEqual(englishKeys);
      for (const key of englishKeys) {
        expect(HISTORY_TRANSLATIONS[id][key as keyof typeof HISTORY_TRANSLATIONS.en].trim(), `${id}.${key}`).not.toBe('');
      }
    }
  });
});
