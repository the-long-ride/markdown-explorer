import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { applyLintSuppressions, type InsightsLintFinding } from '../../../../ui/src/insights/lint';

function ruleIds(source: string): string[] {
  return analyzeDocument({ path: 'lint.md', source, revision: source }).lint.map(finding => finding.ruleId);
}

describe('workspace insights linting', () => {
  it('finds duplicate headings, table shape errors, list inconsistencies, and trailing whitespace', () => {
    const source = [
      '# A',
      '### C',
      '# A',
      '',
      '| A | B |',
      '| -- | nope |',
      '| one | two | three |',
      '',
      '- one',
      '* two',
      '   - oddly indented',
      'trailing  ',
    ].join('\n');

    const ids = ruleIds(source);
    expect(ids).toEqual(expect.arrayContaining([
      'heading/skipped-level',
      'heading/duplicate',
      'table/malformed-delimiter',
      'table/column-count',
      'list/inconsistent-marker',
      'list/indentation',
      'format/trailing-whitespace',
    ]));
  });

  it('finds malformed Wiki syntax and malformed absolute URI destinations', () => {
    const ids = ruleIds([
      '# Links',
      'Broken [[Wiki link',
      '[bad](https://exa mple.test/path)',
      '<a href="http://[::1"></a>',
    ].join('\n'));

    expect(ids).toContain('wiki/malformed');
    expect(ids).toContain('link/malformed-uri');
  });

  it('flags clearly invalid Mermaid fences without rendering them', () => {
    const ids = ruleIds([
      '# Diagram',
      '```mermaid',
      'this is not a mermaid diagram declaration',
      '```',
    ].join('\n'));
    expect(ids).toContain('mermaid/invalid');
  });

  it('applies per-rule enablement and severity without changing the raw diagnostic', () => {
    const result = analyzeDocument({
      path: 'severity.md',
      source: '# A  \n### C\n',
      revision: '1',
      lintRules: {
        'format/trailing-whitespace': { enabled: false, severity: 'info' },
        'heading/skipped-level': { enabled: true, severity: 'error' },
      },
    });

    expect(result.lint.some(finding => finding.ruleId === 'format/trailing-whitespace')).toBe(false);
    expect(result.lint.find(finding => finding.ruleId === 'heading/skipped-level')?.severity).toBe('error');
  });

  it('supports reversible rule, path, and exact-finding suppressions', () => {
    const findings: InsightsLintFinding[] = [
      { id: 'a', path: 'guide.md', ruleId: 'heading/duplicate', severity: 'warning', message: 'duplicate', line: 2 },
      { id: 'b', path: 'other.md', ruleId: 'heading/duplicate', severity: 'warning', message: 'duplicate', line: 3 },
      { id: 'c', path: 'guide.md', ruleId: 'format/trailing-whitespace', severity: 'info', message: 'space', line: 5 },
    ];

    expect(applyLintSuppressions(findings, [{ scope: 'finding', findingId: 'c' }]).map(item => item.id)).toEqual(['a', 'b']);
    expect(applyLintSuppressions(findings, [{ scope: 'path-rule', path: 'guide.md', ruleId: 'heading/duplicate' }]).map(item => item.id)).toEqual(['b', 'c']);
    expect(applyLintSuppressions(findings, [{ scope: 'rule', ruleId: 'heading/duplicate' }]).map(item => item.id)).toEqual(['c']);
    expect(applyLintSuppressions(findings, []).map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});
