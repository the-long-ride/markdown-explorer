import { describe, expect, it } from 'vitest';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';
import {
  EDITOR_UI_TRANSLATIONS,
  formatTableDimensions,
  getEditorUiTranslations,
} from '../../../../ui/src/contexts/editorUiTranslations';

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
  'unsavedChangesTitle',
  'fileNotSavedPrompt',
  'dontSaveAndLeave',
  'diskVersion',
  'myEdit',
  'toggleFormattingToolbar',
  'saveFailed',
  'saveFailedReadOnly',
  'saveFailedPermissionDenied',
  'saveFailedMissing',
  'saveFailedOutsideWorkspace',
  'saveFailedWriteFailed',
  'insertTable',
  'tableColumns',
  'tableRows',
  'tableDimensions',
  'insertTableRowAbove',
  'insertTableRowBelow',
  'deleteTableRow',
  'insertTableColumnLeft',
  'insertTableColumnRight',
  'deleteTableColumn',
  'viewRawMarkdown',
  'viewRenderedTable',
  'insertLineBelow',
  'insertLink',
  'linkUrl',
  'linkUrlPlaceholder',
  'linkText',
  'linkTextPlaceholder',
  'tableCellHint',
  'pasteUrl',
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

  it('formats table dimensions correctly across all supported languages', () => {
    // English
    const en = getEditorUiTranslations('en');
    expect(formatTableDimensions(en.tableDimensions, 43, 10)).toBe('Row 43 × 10 Columns');
    expect(formatTableDimensions(en.tableDimensions, 1, 1)).toBe('Row 1 × 1 Column');

    // Vietnamese
    const vi = getEditorUiTranslations('vi');
    expect(formatTableDimensions(vi.tableDimensions, 43, 10)).toBe('Hàng 43 × 10 Cột');

    // French
    const fr = getEditorUiTranslations('fr');
    expect(formatTableDimensions(fr.tableDimensions, 43, 10)).toBe('Ligne 43 × 10 colonnes');
    expect(formatTableDimensions(fr.tableDimensions, 1, 1)).toBe('Ligne 1 × 1 colonne');

    // Spanish
    const es = getEditorUiTranslations('es');
    expect(formatTableDimensions(es.tableDimensions, 43, 10)).toBe('Fila 43 × 10 columnas');
    expect(formatTableDimensions(es.tableDimensions, 1, 1)).toBe('Fila 1 × 1 columna');

    // Chinese
    const zh = getEditorUiTranslations('zh');
    expect(formatTableDimensions(zh.tableDimensions, 43, 10)).toBe('43 行 × 10 列');

    // Norwegian
    const no = getEditorUiTranslations('no');
    expect(formatTableDimensions(no.tableDimensions, 43, 10)).toBe('Rad 43 × 10 kolonner');
    expect(formatTableDimensions(no.tableDimensions, 1, 1)).toBe('Rad 1 × 1 kolonne');

    // Japanese
    const ja = getEditorUiTranslations('ja');
    expect(formatTableDimensions(ja.tableDimensions, 43, 10)).toBe('43 行 × 10 列');

    // Korean
    const ko = getEditorUiTranslations('ko');
    expect(formatTableDimensions(ko.tableDimensions, 43, 10)).toBe('43행 × 10열');

    // Russian
    const ru = getEditorUiTranslations('ru');
    expect(formatTableDimensions(ru.tableDimensions, 43, 10)).toBe('Строк: 43 × столбцов: 10');
    expect(formatTableDimensions(ru.tableDimensions, 1, 1)).toBe('Строк: 1 × столбцов: 1');
  });
});
