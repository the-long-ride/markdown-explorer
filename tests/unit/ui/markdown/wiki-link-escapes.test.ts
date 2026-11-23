import { describe, expect, it } from 'vitest';
import { parseWikiLink } from '../../../../ui/src/markdown/wikiLinks';

describe('parseWikiLink escapes', () => {
  it('unescapes label characters and turns path backslashes into separators', () => {
    const parsed = parseWikiLink('[[dir\\note|Label \\x end\\]]') as any;
    expect(parsed.ok).not.toBe(false);
    expect(parsed.label).toContain('Label x');
    expect(parsed.target).toContain('dir/note');
    const escaped = parseWikiLink('[[a\\#b\\|c|L\\\\]]') as any;
    expect(escaped.target).toContain('a#b|c');
  });
});
