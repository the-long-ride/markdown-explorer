import { describe, expect, it } from 'vitest';
import { EXPORT_SCOPE_TRANSLATIONS } from '../../../../ui/src/contexts/exportScopeTranslations';

describe('Export Center layout naming', () => {
  it('brands the explorer layout as Full Markdown Explorer in every language', () => {
    for (const translations of Object.values(EXPORT_SCOPE_TRANSLATIONS)) {
      expect(translations.exportCenter.options.fullExplorerLayout).toContain('Markdown Explorer');
    }
    expect(EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.options.fullExplorerLayout).toBe('Full Markdown Explorer layout');
  });
});
