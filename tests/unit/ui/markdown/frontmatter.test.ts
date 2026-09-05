import { describe, expect, it } from 'vitest';
import { parseFrontmatterDocument } from '../../../../ui/src/markdown/frontmatter';
import { parse } from '../../../../ui/src/markdown/parser';

describe('parseFrontmatterDocument', () => {
  it('parses title, aliases and tags without losing source mapping', () => {
    const parsed = parseFrontmatterDocument(`---\ntitle: Setup\naliases:\n  - Install\n  - Setup Guide\ntags: [api, docs]\n---\n# Body\n`);
    expect(parsed.metadata).toEqual({
      title: 'Setup',
      aliases: ['Install', 'Setup Guide'],
      tags: ['api', 'docs'],
    });
    expect(parsed.body).toBe('# Body\n');
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.sourceSegments[0]).toMatchObject({ bodyStart: 0 });
  });

  it('accepts scalar aliases and tags and normalizes them to lists', () => {
    const parsed = parseFrontmatterDocument(`---\ntitle: Guide\naliases: Install\ntags: docs\n---\nBody\n`);
    expect(parsed.metadata).toEqual({ title: 'Guide', aliases: ['Install'], tags: ['docs'] });
  });

  it('ignores only a duplicated key and preserves unrelated metadata', () => {
    const parsed = parseFrontmatterDocument(`---\ntitle: One\ntitle: Two\ntags: [docs]\n---\nBody\n`);
    expect(parsed.metadata.title).toBeUndefined();
    expect(parsed.metadata.tags).toEqual(['docs']);
    expect(parsed.diagnostics.map((d) => d.ruleId)).toContain('frontmatter/duplicate-key');
    expect(parsed.diagnostics.find((d) => d.ruleId === 'frontmatter/duplicate-key')?.severity).toBe('error');
  });

  it('reports malformed YAML but keeps the Markdown body analyzable', () => {
    const source = `---\ntitle: [broken\n---\n# Body\n\nText\n`;
    const parsed = parseFrontmatterDocument(source);
    expect(parsed.metadata).toEqual({ aliases: [], tags: [] });
    expect(parsed.body).toBe('# Body\n\nText\n');
    expect(parsed.diagnostics.map((d) => d.ruleId)).toContain('frontmatter/malformed');
    expect(parse(source).tokens.some((token) => token.type === 'heading' && token.text === 'Body')).toBe(true);
  });

  it('warns on invalid insights metadata shapes while preserving other valid fields', () => {
    const parsed = parseFrontmatterDocument(`---\ntitle:\n  nested: value\naliases: [ok, { bad: shape }]\ntags: [docs, 42]\n---\nBody\n`);
    expect(parsed.metadata.title).toBeUndefined();
    expect(parsed.metadata.aliases).toEqual(['ok']);
    expect(parsed.metadata.tags).toEqual(['docs']);
    expect(parsed.diagnostics.filter((d) => d.ruleId === 'frontmatter/invalid-insights-metadata').length).toBeGreaterThanOrEqual(3);
  });

  it('keeps renderer-compatible scalar flat frontmatter values', () => {
    const parsed = parseFrontmatterDocument(`---\ntitle: Setup\ndescription: Hello world\naliases: [Install, Setup Guide]\n---\nBody\n`);
    expect(parsed.flatFrontmatter.title).toBe('Setup');
    expect(parsed.flatFrontmatter.description).toBe('Hello world');
    expect(parsed.flatFrontmatter.aliases).toBe('[Install, Setup Guide]');
  });
});
