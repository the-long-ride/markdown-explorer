import type { Translations } from './translationTypes';

type DesktopTypographyTranslationKey =
  | 'typography' | 'typographyDesc' | 'appUiFont' | 'bodyFont' | 'headingFont' | 'quoteFont' | 'codeFont'
  | 'fontDefault' | 'fontDefaultDescription' | 'fontSystem' | 'fontImported'
  | 'fontImport' | 'fontRemove'
  | 'fontApply' | 'fontApplyConfirmTitle' | 'fontApplyConfirmBody' | 'fontApplyChanges' | 'fontSearchPlaceholder' | 'fontNoResults'
  | 'fontVariant' | 'fontResetRole' | 'fontNormal' | 'fontItalic';

export const DESKTOP_TYPOGRAPHY_EN: Pick<Translations, DesktopTypographyTranslationKey> = {
  typography: 'Typography',
  typographyDesc: 'Desktop and VS Code. Bind a system or imported font and explicit variant to each app and content role.',
  appUiFont: 'App UI', bodyFont: 'Body', headingFont: 'Heading', quoteFont: 'Quote', codeFont: 'Code', fontDefault: 'Default',
  fontDefaultDescription: 'Uses the Markdown Explorer default.',
  fontSystem: 'System fonts', fontImported: 'Imported fonts',
  fontImport: 'Import font file',
  fontRemove: 'Remove selected import', fontApply: 'Apply',
  fontApplyConfirmTitle: 'Apply typography changes?',
  fontApplyConfirmBody: 'Review the changed roles before applying them.',
  fontApplyChanges: 'Apply changes',
  fontSearchPlaceholder: 'Search fonts…', fontNoResults: 'No matching fonts',
  fontVariant: 'Variant', fontResetRole: 'Reset this font role to default',
  fontNormal: 'Normal', fontItalic: 'Italic',
};
