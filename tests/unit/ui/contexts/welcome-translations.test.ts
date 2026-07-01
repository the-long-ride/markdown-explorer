import { describe, expect, test } from 'vitest';

import { WELCOME_TRANSLATIONS } from '../../../../ui/src/contexts/welcomeTranslations';

const LANGUAGE_KEYS = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];

describe('welcomeTranslations', () => {
  test('WELCOME_TRANSLATIONS has all 9 language keys', () => {
    for (const key of LANGUAGE_KEYS) {
      expect(WELCOME_TRANSLATIONS[key]).toBeDefined();
    }
    expect(Object.keys(WELCOME_TRANSLATIONS)).toHaveLength(9);
  });

  test.each(LANGUAGE_KEYS)('language %s has hero, privacy, features, shortcutsTable, issues', (lang) => {
    const t = WELCOME_TRANSLATIONS[lang];
    expect(t.hero).toBeDefined();
    expect(t.privacy).toBeDefined();
    expect(t.features).toBeDefined();
    expect(t.shortcutsTable).toBeDefined();
    expect(t.issues).toBeDefined();
  });

  test.each(LANGUAGE_KEYS)('language %s hero has title, descDesktop, descVSCode', (lang) => {
    const hero = WELCOME_TRANSLATIONS[lang].hero;
    expect(typeof hero.title).toBe('string');
    expect(typeof hero.descDesktop).toBe('string');
    expect(typeof hero.descVSCode).toBe('string');
    expect(hero.title.length).toBeGreaterThan(0);
  });

  test.each(LANGUAGE_KEYS)('language %s privacy has title, desc, bullets array with at least 2 items', (lang) => {
    const privacy = WELCOME_TRANSLATIONS[lang].privacy;
    expect(typeof privacy.title).toBe('string');
    expect(typeof privacy.desc).toBe('string');
    expect(Array.isArray(privacy.bullets)).toBe(true);
    expect(privacy.bullets.length).toBeGreaterThanOrEqual(2);
  });

  test('English hero title is expected value', () => {
    expect(WELCOME_TRANSLATIONS.en.hero.title).toBe('Welcome to Markdown Explorer');
  });

  test('English privacy bullets contain tracking mention', () => {
    const bullets = WELCOME_TRANSLATIONS.en.privacy.bullets;
    expect(bullets.some(b => /tracking/i.test(b))).toBe(true);
  });

  test('English features has all sub-sections', () => {
    const f = WELCOME_TRANSLATIONS.en.features;
    expect(f.tree).toBeDefined();
    expect(f.search).toBeDefined();
    expect(f.tables).toBeDefined();
    expect(f.charts).toBeDefined();
    expect(f.highlight).toBeDefined();
    expect(f.modal).toBeDefined();
    expect(f.shortcuts).toBeDefined();
  });

  test('English shortcutsTable has headers and rows', () => {
    const st = WELCOME_TRANSLATIONS.en.shortcutsTable;
    expect(st.headers.action).toBe('Action');
    expect(st.headers.shortcut).toBe('Default Shortcut');
    expect(st.rows.back).toBeDefined();
    expect(st.rows.zoomIn).toBeDefined();
  });
});
