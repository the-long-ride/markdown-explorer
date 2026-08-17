import { describe, expect, test } from 'vitest';
import { getTranslations } from '../../../ui/src/contexts/translations';

describe('chart save toast translations', () => {
  test('all locales expose chart save outcome labels', () => {
    for (const locale of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
      const t = getTranslations(locale);
      expect((t.rendererUi as Record<string, string>).chartSaveSuccess?.trim().length).toBeGreaterThan(3);
      expect((t.rendererUi as Record<string, string>).chartSaveFailed?.trim().length).toBeGreaterThan(3);
    }
  });
});
