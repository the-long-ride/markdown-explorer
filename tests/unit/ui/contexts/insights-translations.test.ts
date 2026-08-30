import { describe, expect, it } from 'vitest';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';
import { AUDITED_UI_TRANSLATIONS } from '../../../../ui/src/contexts/auditedUiTranslations';

describe('Workspace Insights localization', () => {
  it('provides the full Insights domain in every supported locale', () => {
    const english = (AUDITED_UI_TRANSLATIONS.en as any).insights;
    expect(english).toBeDefined();
    const expectedKeys = Object.keys(english).sort();
    for (const { id } of LANGUAGE_OPTIONS) {
      const translated = (AUDITED_UI_TRANSLATIONS[id] as any).insights;
      expect(translated, `missing Insights translations for ${id}`).toBeDefined();
      expect(Object.keys(translated).sort()).toEqual(expectedKeys);
      for (const key of expectedKeys) expect(String(translated[key]).trim(), `${id}.${key}`).not.toBe('');
    }
  });

  it('states the external-check privacy and uncertainty contract in every locale', () => {
    for (const { id } of LANGUAGE_OPTIONS) {
      const copy = String((AUDITED_UI_TRANSLATIONS[id] as any).insights?.externalLinksDescription ?? '');
      expect(copy.length, `${id} external link description`).toBeGreaterThan(40);
    }
    const english = String((AUDITED_UI_TRANSLATIONS.en as any).insights.externalLinksDescription).toLowerCase();
    expect(english).toContain('cookies');
    expect(english).toContain('authorization');
    expect(english).toContain('private');
    expect(english).toContain('unknown');
    expect(english).toContain('disabled');
  });

  it('localizes renderer Wiki Link failure states', () => {
    for (const { id } of LANGUAGE_OPTIONS) {
      const rendererUi = (AUDITED_UI_TRANSLATIONS[id] as any).rendererUi;
      expect(String(rendererUi.wikiTransclusionCycle ?? '').trim(), `${id}.wikiTransclusionCycle`).not.toBe('');
      expect(String(rendererUi.wikiTransclusionDepth ?? '').trim(), `${id}.wikiTransclusionDepth`).not.toBe('');
      expect(String(rendererUi.wikiLinkAmbiguous ?? '').trim(), `${id}.wikiLinkAmbiguous`).not.toBe('');
    }
  });
});
