import { describe, it, expect } from 'vitest';
import { WELCOME_TRANSLATIONS } from '../../../ui/src/contexts/welcomeTranslations';

describe('welcomeTranslations', () => {
  it('exports WELCOME_TRANSLATIONS with all supported languages', () => {
    expect(WELCOME_TRANSLATIONS).toBeDefined();
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('en');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('vi');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('fr');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('es');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('zh');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('no');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('ja');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('ko');
    expect(Object.keys(WELCOME_TRANSLATIONS)).toContain('ru');
  });

  it('has hero translations for each language', () => {
    for (const lang of Object.keys(WELCOME_TRANSLATIONS)) {
      const t = WELCOME_TRANSLATIONS[lang];
      expect(t.hero.title).toBeTruthy();
      expect(t.hero.descDesktop).toBeTruthy();
      expect(t.hero.descVSCode).toBeTruthy();
      expect(t.hero.createdBy).toBeTruthy();
      expect(t.hero.repository).toBeTruthy();
      expect(t.hero.license).toBeTruthy();
      expect(t.hero.desktopRecommendation).toBeTruthy();
      expect(t.hero.desktopAppLinkText).toBeTruthy();
      expect(t.hero.macosInstallBtn).toBeTruthy();
    }
  });

  it('has privacy translations for each language', () => {
    for (const lang of Object.keys(WELCOME_TRANSLATIONS)) {
      const t = WELCOME_TRANSLATIONS[lang];
      expect(t.privacy.title).toBeTruthy();
      expect(t.privacy.desc).toBeTruthy();
      expect(t.privacy.bullets.length).toBe(3);
    }
  });

  it('has features translations for each language', () => {
    for (const lang of Object.keys(WELCOME_TRANSLATIONS)) {
      const t = WELCOME_TRANSLATIONS[lang];
      expect(t.features.title).toBeTruthy();
      expect(t.features.tree.title).toBeTruthy();
      expect(t.features.search.title).toBeTruthy();
      expect(t.features.tables.title).toBeTruthy();
      expect(t.features.charts.title).toBeTruthy();
      expect(t.features.highlight.title).toBeTruthy();
      expect(t.features.modal.title).toBeTruthy();
      expect(t.features.shortcuts.title).toBeTruthy();
    }
  });

  it('has shortcuts table for each language', () => {
    for (const lang of Object.keys(WELCOME_TRANSLATIONS)) {
      const t = WELCOME_TRANSLATIONS[lang];
      expect(t.shortcutsTable.headers.action).toBeTruthy();
      expect(t.shortcutsTable.headers.shortcut).toBeTruthy();
      expect(t.shortcutsTable.rows.back).toBeTruthy();
      expect(t.shortcutsTable.note).toBeTruthy();
    }
  });

  it('has issues translations for each language', () => {
    for (const lang of Object.keys(WELCOME_TRANSLATIONS)) {
      const t = WELCOME_TRANSLATIONS[lang];
      expect(t.issues.title).toBeTruthy();
      expect(t.issues.hint).toBeTruthy();
      expect(t.issues.linkText).toBeTruthy();
      expect(t.issues.bullets.length).toBeGreaterThan(0);
    }
  });

  it('has distinct titles across languages', () => {
    const titles = Object.values(WELCOME_TRANSLATIONS).map((t) => t.hero.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
