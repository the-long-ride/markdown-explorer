import { describe, expect, it } from 'vitest';
import { HISTORY_TRANSLATIONS } from '../../../../ui/src/contexts/historyTranslations';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';

const repositoryHistoryKeys = [
  'repositoryHistory',
  'repositoryHistoryTooltip',
  'loadingRepositoryHistory',
  'noRepositoryHistory',
  'repositoryHistoryUnavailable',
  'commitFiles',
  'loadingRevisionFiles',
  'noRevisionFiles',
  'revisionFilesUnavailable',
  'backToHead',
  'browseCommit',
  'openSnapshotFile',
  'snapshotReadOnly',
  'snapshotFileUnavailable',
  'head',
] as const;

describe('history translations', () => {
  it('defines every history and diff label for every supported language', () => {
    const englishKeys = Object.keys(HISTORY_TRANSLATIONS.en).sort();
    for (const { id } of LANGUAGE_OPTIONS) {
      expect(Object.keys(HISTORY_TRANSLATIONS[id]).sort(), id).toEqual(englishKeys);
      for (const key of englishKeys) {
        expect(HISTORY_TRANSLATIONS[id][key as keyof typeof HISTORY_TRANSLATIONS.en].trim(), `${id}.${key}`).not.toBe('');
      }
    }
  });

  it('defines the repository snapshot browsing labels for every supported language', () => {
    for (const { id } of LANGUAGE_OPTIONS) {
      for (const key of repositoryHistoryKeys) {
        expect(HISTORY_TRANSLATIONS[id][key].trim(), `${id}.${key}`).not.toBe('');
      }
    }
  });
});
