import { describe, it, expect } from 'vitest';
import { WELCOME_TRANSLATIONS } from '../../../../ui/src/contexts/welcomeTranslations';

describe('WELCOME_TRANSLATIONS', () => {
  it('contains expected locales', () => {
    expect(WELCOME_TRANSLATIONS.en).toBeDefined();
    expect(WELCOME_TRANSLATIONS.vi).toBeDefined();
    expect(WELCOME_TRANSLATIONS.fr).toBeDefined();
    expect(WELCOME_TRANSLATIONS.es).toBeDefined();
    expect(WELCOME_TRANSLATIONS.zh).toBeDefined();
    expect(WELCOME_TRANSLATIONS.no).toBeDefined();
    expect(WELCOME_TRANSLATIONS.ja).toBeDefined();
    expect(WELCOME_TRANSLATIONS.ko).toBeDefined();
    expect(WELCOME_TRANSLATIONS.ru).toBeDefined();
  });

  it('has hero title for all locales', () => {
    for (const locale of Object.values(WELCOME_TRANSLATIONS)) {
      expect(locale.hero.title).toBeTruthy();
    }
  });
});
