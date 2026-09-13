import { describe, expect, it } from 'vitest';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';
import { EDITOR_UI_TRANSLATIONS, getEditorUiTranslations } from '../../../../ui/src/contexts/editorUiTranslations';

const REQUIRED_LABELS = [
  'modeGroup',
  'rendered',
  'inlineEdit',
  'plain',
  'save',
  'plainSourceLabel',
  'inlineSourceLabel',
  'apply',
  'cancel',
  'unsavedChanges',
  'diskVersion',
  'myEdit',
] as const;

describe('editor UI translations', () => {
  it('covers every supported app language with non-empty editor labels', () => {
    expect(Object.keys(EDITOR_UI_TRANSLATIONS).sort()).toEqual(LANGUAGE_OPTIONS.map((item) => item.id).sort());
    for (const { id } of LANGUAGE_OPTIONS) {
      const labels = getEditorUiTranslations(id);
      for (const key of REQUIRED_LABELS) expect(labels[key].trim()).not.toBe('');
    }
  });

  it('falls back to English for an unknown language', () => {
    expect(getEditorUiTranslations('unknown' as never)).toEqual(EDITOR_UI_TRANSLATIONS.en);
  });
});
