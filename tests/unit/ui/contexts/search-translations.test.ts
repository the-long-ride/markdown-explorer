import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../../../../ui/src/contexts/translationsData';

const requiredKeys = [
  'dialogLabel', 'modalTitleCurrent', 'modalTitleAllTabs', 'queryLabel',
  'workspaces', 'allWorkspaces', 'results', 'preview', 'matchCase',
  'searchingContents', 'noMatches', 'openResult', 'previewEmptyTitle',
  'previewEmptyBody', 'findDialogLabel', 'findPlaceholder', 'findInputLabel',
  'previousMatch', 'nextMatch', 'closeFind', 'sidebarPlaceholder',
  'sidebarInputLabel', 'minimumCharacters', 'searchingWorkspace',
  'includeWorkspace', 'excludeWorkspace', 'checkAllWorkspaces',
  'uncheckAllWorkspaces', 'resizeWorkspaces', 'resizePreview',
  'loadingPreview', 'previewUnavailable',
] as const;

describe('search translations', () => {
  it('provides every search label for all supported languages', () => {
    for (const locale of Object.values(TRANSLATIONS)) {
      for (const key of requiredKeys) {
        expect(locale.search[key]).toBeTruthy();
      }
    }
  });
});
