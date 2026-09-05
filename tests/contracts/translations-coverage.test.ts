import { describe, expect, test } from 'vitest';
import { getTranslations, LANGUAGE_OPTIONS } from '../../ui/src/contexts/translations';
import { TRANSLATIONS } from '../../ui/src/contexts/translationsData';
import { AUDITED_UI_TRANSLATIONS } from '../../ui/src/contexts/auditedUiTranslations';
import { WELCOME_TRANSLATIONS } from '../../ui/src/contexts/welcomeTranslations';
import { USER_MANUAL_TRANSLATIONS } from '../../ui/src/contexts/userManualTranslations';
import { DESKTOP_TYPOGRAPHY_EN } from '../../ui/src/contexts/desktopTypographyTranslations';
import { EXPORT_SCOPE_TRANSLATIONS } from '../../ui/src/contexts/exportScopeTranslations';
import { INSIGHTS_TRANSLATIONS } from '../../ui/src/contexts/insightsTranslations';
import { INSIGHTS_UI_TRANSLATIONS } from '../../ui/src/contexts/insightsUiTranslations';
import { SUPPORT_PROMPT_TRANSLATIONS } from '../../ui/src/contexts/supportPromptTranslations';

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
      verifyObjectKeysRecursive(refValue as Record<string, unknown>, targetValue as Record<string, unknown>, currentPath);
    } else if (typeof refValue === 'string') {
      expect(typeof targetValue, `Path ${currentPath} should be a string`).toBe('string');
      expect((targetValue as string).trim(), `Path ${currentPath} should not be empty`).not.toBe('');
    }
  }
}

describe('translation coverage across all supported languages', () => {
  const expectedLanguages = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'] as const;

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

  test('AUDITED_UI_TRANSLATIONS contains all keys across all supported languages', () => {
    const englishTemplate = AUDITED_UI_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = AUDITED_UI_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Audited UI block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `auditedUi.${lang}`);
    }
  });

  test('WELCOME_TRANSLATIONS contains all keys across all supported languages', () => {
    const englishTemplate = WELCOME_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = WELCOME_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Welcome block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `welcome.${lang}`);
    }
  });

  test('USER_MANUAL_TRANSLATIONS contains all keys across all supported languages', () => {
    const englishTemplate = USER_MANUAL_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = USER_MANUAL_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `User manual block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `userManual.${lang}`);
    }
  });

  test('EXPORT_SCOPE_TRANSLATIONS covers every Export Center and Scope View key in all supported languages', () => {
    const englishTemplate = EXPORT_SCOPE_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = EXPORT_SCOPE_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Export/Scope block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `exportScope.${lang}`);
    }
  });

  test('Export Center and Scope View are actually translated outside English', () => {
    for (const lang of expectedLanguages.filter((value) => value !== 'en')) {
      expect(EXPORT_SCOPE_TRANSLATIONS[lang].exportCenter.title).not.toBe(EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.title);
      expect(EXPORT_SCOPE_TRANSLATIONS[lang].scopeView.dialogLabel).not.toBe(EXPORT_SCOPE_TRANSLATIONS.en.scopeView.dialogLabel);
      expect(EXPORT_SCOPE_TRANSLATIONS[lang].scopeView.openAsScope).not.toBe(EXPORT_SCOPE_TRANSLATIONS.en.scopeView.openAsScope);
    }
  });

  test('INSIGHTS_TRANSLATIONS contains all keys across all supported languages', () => {
    const englishTemplate = INSIGHTS_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = INSIGHTS_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Insights translations block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `insights.${lang}`);
    }
  });

  test('INSIGHTS_UI_TRANSLATIONS contains all presentation keys across all supported languages', () => {
    const englishTemplate = INSIGHTS_UI_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = INSIGHTS_UI_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Insights UI block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `insightsUi.${lang}`);
    }
  });

  test('Workspace Insights is actually translated outside English', () => {
    for (const lang of expectedLanguages.filter((value) => value !== 'en')) {
      expect(INSIGHTS_TRANSLATIONS[lang].title).not.toBe(INSIGHTS_TRANSLATIONS.en.title);
      expect(INSIGHTS_TRANSLATIONS[lang].scopeAndNetwork).not.toBe(INSIGHTS_TRANSLATIONS.en.scopeAndNetwork);
      expect(INSIGHTS_TRANSLATIONS[lang].limitsAndTuning).not.toBe(INSIGHTS_TRANSLATIONS.en.limitsAndTuning);
      expect(INSIGHTS_TRANSLATIONS[lang].patternFilters).not.toBe(INSIGHTS_TRANSLATIONS.en.patternFilters);
    }
  });

  test('DESKTOP_TYPOGRAPHY keys exist in TRANSLATIONS across all supported languages', () => {
    for (const lang of expectedLanguages) {
      const localeTranslations = TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Translations block for "${lang}" must exist`).toBeDefined();
      for (const key of Object.keys(DESKTOP_TYPOGRAPHY_EN)) {
        expect(localeTranslations, `Missing typography key "${key}" in language "${lang}"`).toHaveProperty(key);
        expect(typeof localeTranslations[key], `Typography key "${key}" in "${lang}" should be a string`).toBe('string');
        expect((localeTranslations[key] as string).trim(), `Typography key "${key}" in "${lang}" should not be empty`).not.toBe('');
      }
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

  test('SUPPORT_PROMPT_TRANSLATIONS contains all keys across all supported languages', () => {
    const englishTemplate = SUPPORT_PROMPT_TRANSLATIONS.en as unknown as Record<string, unknown>;
    for (const lang of expectedLanguages) {
      const localeTranslations = SUPPORT_PROMPT_TRANSLATIONS[lang] as unknown as Record<string, unknown>;
      expect(localeTranslations, `Support prompt block for "${lang}" must exist`).toBeDefined();
      verifyObjectKeysRecursive(englishTemplate, localeTranslations, `supportPrompt.${lang}`);
    }
  });

  test('Support prompt strings are actually translated outside English', () => {
    for (const lang of expectedLanguages.filter((value) => value !== 'en')) {
      expect(SUPPORT_PROMPT_TRANSLATIONS[lang].title).not.toBe(SUPPORT_PROMPT_TRANSLATIONS.en.title);
      expect(SUPPORT_PROMPT_TRANSLATIONS[lang].starButton).not.toBe(SUPPORT_PROMPT_TRANSLATIONS.en.starButton);
      expect(SUPPORT_PROMPT_TRANSLATIONS[lang].donateButton).not.toBe(SUPPORT_PROMPT_TRANSLATIONS.en.donateButton);
      expect(SUPPORT_PROMPT_TRANSLATIONS[lang].dontShowAgain).not.toBe(SUPPORT_PROMPT_TRANSLATIONS.en.dontShowAgain);
      expect(SUPPORT_PROMPT_TRANSLATIONS[lang].close).not.toBe(SUPPORT_PROMPT_TRANSLATIONS.en.close);
      expect(SUPPORT_PROMPT_TRANSLATIONS[lang].homeSupportMessage).not.toBe(SUPPORT_PROMPT_TRANSLATIONS.en.homeSupportMessage);
    }
  });
});
