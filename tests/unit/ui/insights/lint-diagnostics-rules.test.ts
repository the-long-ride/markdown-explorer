import { describe, expect, it } from 'vitest';
import { applyLintSuppressions, lintDocument } from '../../../../ui/src/insights/lint';

describe('lintDocument diagnostics and rule config', () => {
  it('maps frontmatter diagnostics with default and explicit severity and honours rule config', () => {
    const findings = lintDocument({
      path: 'a.md',
      source: '---\ntitle: x\n---\n',
      tokens: [],
      frontmatterDiagnostics: [
        { ruleId: 'frontmatter-invalid', message: 'bad', line: 2, severity: 'error' } as any,
        { ruleId: 'custom-unknown-rule', message: 'meh' } as any,
        { ruleId: 'disabled-rule', message: 'skip' } as any,
      ],
      lintRules: { 'disabled-rule': { enabled: false }, 'custom-unknown-rule': { severity: 'info' } } as any,
    });
    expect(findings.map((f) => f.ruleId).sort()).toEqual(['custom-unknown-rule', 'frontmatter-invalid']);
    const explicit = findings.find((f) => f.ruleId === 'frontmatter-invalid')!;
    const custom = findings.find((f) => f.ruleId === 'custom-unknown-rule')!;
    expect(explicit).toMatchObject({ severity: 'error', defaultSeverity: 'error', line: 2 });
    expect(custom).toMatchObject({ severity: 'info', defaultSeverity: 'warning' });
    expect(custom.line).toBeUndefined();
    expect(applyLintSuppressions(findings, [{ scope: 'path-rule', path: 'a.md', ruleId: 'custom-unknown-rule' } as any])).toHaveLength(1);
    expect(applyLintSuppressions(findings, [{ scope: 'finding', findingId: explicit.id } as any])).toHaveLength(1);
    expect(applyLintSuppressions(findings, undefined)).toHaveLength(2);
  });
});
