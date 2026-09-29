import type { AppSettings } from '../types';

export function isMarkdownEditingAvailable(settings: Pick<AppSettings, 'markdownEditingEnabled'>): boolean {
  return settings.markdownEditingEnabled === true;
}

export function isMarkdownEditingMode(mode: string): boolean {
  return mode === 'inline-edit' || mode === 'plain';
}

export function isDocumentViewModeAllowed(
  settings: Pick<AppSettings, 'markdownEditingEnabled'>,
  mode: string,
): boolean {
  return !isMarkdownEditingMode(mode) || isMarkdownEditingAvailable(settings);
}
