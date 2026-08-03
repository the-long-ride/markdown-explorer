import { describe, expect, it } from 'vitest';
import { searchVirtualFiles } from '../../../../website-app/src/web-test-search';

describe('website virtual workspace search case sensitivity', () => {
  it('uses exact casing only when matchCase is enabled', () => {
    const insensitive = searchVirtualFiles('markdown', 80, { matchCase: false });
    const exactTitleCase = searchVirtualFiles('Markdown', 80, { matchCase: true });
    const exactUpperCase = searchVirtualFiles('MARKDOWN', 80, { matchCase: true });

    expect(insensitive.length).toBeGreaterThan(0);
    expect(exactTitleCase.length).toBeGreaterThan(0);
    expect(exactUpperCase.length).toBeLessThan(exactTitleCase.length);
  });
});
