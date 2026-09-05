import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';
import { AUDITED_UI_TRANSLATIONS } from '../../../../ui/src/contexts/auditedUiTranslations';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../../ui/src/contexts/insightsUiTranslations';
import { INSIGHTS_LINT_RULE_DEFAULTS } from '../../../../ui/src/insights/lint';

function explicitLocaleKeys(): Map<string, Set<string>> {
  const sourcePath = path.resolve(process.cwd(), 'ui/src/contexts/insightsTranslations.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const file = ts.createSourceFile('insightsTranslations.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const result = new Map<string, Set<string>>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const locale = declaration.name.text;
      if (!LANGUAGE_OPTIONS.some(option => option.id === locale)) continue;
      const keys = new Set<string>();
      for (const property of declaration.initializer.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
          const name = property.name;
          if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) keys.add(name.text);
        }
      }
      result.set(locale, keys);
    }
  }
  return result;
}

describe('Workspace Insights localization', () => {
  it('provides the full Insights domain in every supported locale without inherited English omissions', () => {
    const english = (AUDITED_UI_TRANSLATIONS.en as any).insights;
    expect(english).toBeDefined();
    const expectedKeys = Object.keys(english).sort();
    const explicit = explicitLocaleKeys();
    for (const { id } of LANGUAGE_OPTIONS) {
      const translated = (AUDITED_UI_TRANSLATIONS[id] as any).insights;
      expect(translated, `missing Insights translations for ${id}`).toBeDefined();
      expect(Object.keys(translated).sort()).toEqual(expectedKeys);
      for (const key of expectedKeys) expect(String(translated[key]).trim(), `${id}.${key}`).not.toBe('');
      if (id !== 'en') expect([...explicit.get(id) ?? []].sort(), `${id} must explicitly translate every Insights key`).toEqual(expectedKeys);
    }
  });

  it('provides complete presentation dictionaries for every supported locale', () => {
    const english = INSIGHTS_UI_TRANSLATIONS.en.presentation;
    const expectedDomains = Object.keys(english).sort();
    const expectedLintRules = Object.keys(INSIGHTS_LINT_RULE_DEFAULTS).sort();
    for (const { id } of LANGUAGE_OPTIONS) {
      const presentation = INSIGHTS_UI_TRANSLATIONS[id].presentation;
      expect(Object.keys(presentation).sort(), `${id} presentation domains`).toEqual(expectedDomains);
      expect(Object.keys(presentation.galleryCategories).sort(), `${id} gallery categories`).toEqual(Object.keys(english.galleryCategories).sort());
      expect(Object.keys(presentation.statuses).sort(), `${id} statuses`).toEqual(Object.keys(english.statuses).sort());
      expect(Object.keys(presentation.relationshipPresets).sort(), `${id} relationship presets`).toEqual(Object.keys(english.relationshipPresets).sort());
      expect(Object.keys(presentation.lintRules).sort(), `${id} lint rules`).toEqual(expectedLintRules);
      for (const dictionary of [presentation.galleryCategories, presentation.statuses, presentation.relationshipPresets, presentation.lintRules]) {
        for (const [key, value] of Object.entries(dictionary)) expect(String(value).trim(), `${id}.${key}`).not.toBe('');
      }
      if (id !== 'en') {
        expect(presentation.statuses.missing).not.toBe(english.statuses.missing);
        expect(presentation.relationshipPresets.default).not.toBe(english.relationshipPresets.default);
        expect(presentation.lintRules['heading/duplicate']).not.toBe(english.lintRules['heading/duplicate']);
      }
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
