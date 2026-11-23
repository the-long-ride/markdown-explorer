import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDuplicatesAiPrompt, buildGraphAiPrompt, buildLintAiPrompt, copyTextToClipboard } from '../../../../ui/src/insights/aiPrompts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('aiPrompts edge cases', () => {
  it('falls back to execCommand when the clipboard API is missing', async () => {
    vi.stubGlobal('navigator', {});
    (document as any).execCommand = vi.fn(() => true);
    expect(await copyTextToClipboard('x')).toBe(true);
    expect(document.querySelector('textarea')).toBeNull();
    (document as any).execCommand = vi.fn(() => { throw new Error('denied'); });
    expect(await copyTextToClipboard('x')).toBe(false);
  });

  it('sorts lint findings without line numbers and messages', () => {
    const prompt = buildLintAiPrompt([
      { id: '1', path: 'a.md', ruleId: 'r', severity: 'error', message: '', line: 3, column: 2 },
      { id: '2', path: 'a.md', ruleId: 'r', severity: 'error', message: 'm' },
      { id: '3', path: 'a.md', ruleId: 'r', severity: 'error', message: 'n', line: 3, column: 1 },
    ] as any);
    expect(prompt).toContain('Line ?');
    expect(prompt.indexOf('Line ?')).toBeLessThan(prompt.indexOf('Line 3'));
  });

  it('builds graph prompts for broken links, syntax findings and orphans', () => {
    const lintDoc = (path: string, lint: unknown[]) => ({ path, title: path, lint, references: [], headings: [], aliases: [], tags: [] });
    const snapshot = {
      documents: new Map([
        ['a.md', lintDoc('a.md', [{ ruleId: 'wiki/broken', message: 'bad wiki', path: 'a.md' }, { ruleId: 'link/x', message: 'bad', path: 'a.md', line: 2 }, { ruleId: 'heading/x', message: 'h', path: 'a.md' }])],
        ['b.md', lintDoc('b.md', [])],
      ]),
      brokenLinks: [
        { sourcePath: 'a.md', target: 'x', fragment: 'f', status: 'missing', candidates: ['y.md', 'z.md'] },
        { sourcePath: 'a.md', target: 'q', status: 'ambiguous', candidates: [] },
      ],
      outboundLinks: new Map(),
      inboundLinks: new Map(),
      backlinks: new Map(),
    } as any;
    const prompt = buildGraphAiPrompt(snapshot);
    expect(prompt).toContain('x#f');
    expect(prompt).toContain('did you mean');
    expect(prompt).toContain('Line ?');
    const clean = buildGraphAiPrompt({ ...snapshot, brokenLinks: undefined, documents: new Map() });
    expect(typeof clean).toBe('string');
  });

  it('describes exact, section and near duplicate groups', () => {
    const group = (kind: string, score?: number) => ({ kind, score, members: [{ path: 'a.md', line: 1 }, { path: 'b.md', line: 2 }], documents: ['a.md', 'b.md'], paths: ['a.md', 'b.md'] });
    const single = buildDuplicatesAiPrompt([group('exact'), group('section'), group('near')] as any);
    expect(single).toContain('(1 group)');
    expect(single).toContain('high');
    const multi = buildDuplicatesAiPrompt([group('exact'), group('exact'), group('passage'), group('section'), group('near', 0.91), group('near', 0.8)] as any);
    expect(multi).toContain('(2 groups)');
    expect(multi).toContain('91%');
  });
});
