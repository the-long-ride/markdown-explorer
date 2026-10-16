import { describe, expect, it } from 'vitest';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { TRANSLATIONS } from '../../../../ui/src/contexts/translationsData';
import { fillTemplate, formatEntryError, type WorkspaceEntryProblem } from '../../../../ui/src/workspace/workspaceEntryMessages';

const LANGUAGES = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'] as const;
const PROBLEMS: readonly WorkspaceEntryProblem[] = [
  'empty', 'invalid', 'invalid-name', 'reserved', 'protected', 'exists',
  'permission-denied', 'missing', 'outside-workspace', 'unsupported', 'failed',
];

describe('workspace entry messages', () => {
  it('fills every placeholder occurrence', () => {
    expect(fillTemplate('{count} of {count}', { count: 2 })).toBe('2 of 2');
  });

  it('maps host and local reasons to translated text', () => {
    const t = getTranslations('en').sidebar;
    expect(formatEntryError(t, 'exists', 'a.md')).toBe('a.md already exists in this folder.');
    expect(formatEntryError(t, 'invalid-name', 'a:b')).toBe('a:b is not a valid file or folder name.');
    expect(formatEntryError(t, 'permission-denied', 'x')).toBe('Permission denied.');
  });

  it.each(LANGUAGES)('%s resolves every problem to a non-empty message without leftover placeholders', (lang) => {
    const t = TRANSLATIONS[lang].sidebar;
    for (const problem of PROBLEMS) {
      const message = formatEntryError(t, problem, 'sample.md');
      expect(message.trim(), `${lang}:${problem}`).not.toBe('');
      expect(message, `${lang}:${problem}`).not.toMatch(/\{\w+\}/);
    }
  });

  it('keeps placeholders consistent with English across all new sidebar keys', () => {
    const keys = Object.keys(TRANSLATIONS.en.sidebar).filter((key) =>
      /^(new|select|exit|unpin|delete|entry)/.test(key),
    ) as (keyof typeof TRANSLATIONS.en.sidebar)[];
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const lang of LANGUAGES) {
      for (const key of keys) {
        expect(placeholders(TRANSLATIONS[lang].sidebar[key]), `${lang}.${key}`).toBe(placeholders(TRANSLATIONS.en.sidebar[key]));
      }
    }
  });

  it('inline English fallback matches the lazy-loaded English data', () => {
    expect(getTranslations('en').sidebar.entryUnlistedType).toBe("This file type won't appear in the Files tree");
    expect(TRANSLATIONS.en.sidebar.entryUnlistedType).toBe("This file type won't appear in the Files tree");
  });
});
