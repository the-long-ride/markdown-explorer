import { describe, expect, it } from 'vitest';
import { resolveWorkspaceIdentity } from '../../../../ui/src/insights/workspaceIdentity';
import { createWorkspaceInsightsCacheContext } from '../../../../ui/src/insights/workspaceInsightsSession';

describe('workspace identity', () => {
  it('reuses exact path identity', () => {
    expect(resolveWorkspaceIdentity({ workspacePath: '/a/work', history: [{ key: 'stable', path: '/a/work', fingerprint: 'f' }] }).key).toBe('stable');
  });
  it('migrates high-confidence moved workspace identity when one fingerprint matches', () => {
    const identity = resolveWorkspaceIdentity({ workspacePath: '/b/work', fingerprint: 'same', history: [{ key: 'stable', path: '/a/work', fingerprint: 'same' }] });
    expect(identity).toMatchObject({ key: 'stable', confidence: 'moved-high-confidence', movedFrom: '/a/work' });
  });
  it('does not guess when moved-workspace fingerprints are ambiguous', () => {
    const identity = resolveWorkspaceIdentity({ workspacePath: '/c/work', fingerprint: 'same', history: [{ key: 'one', path: '/a', fingerprint: 'same' }, { key: 'two', path: '/b', fingerprint: 'same' }] });
    expect(identity.confidence).toBe('new');
    expect(identity.key).not.toBe('one');
  });
  it('normalizes slash style and trailing separators before deriving a new cache identity', () => {
    expect(resolveWorkspaceIdentity({ workspacePath: 'C:\\Docs\\Project\\' }).key)
      .toBe(resolveWorkspaceIdentity({ workspacePath: 'C:/Docs/Project' }).key);
  });
  it('derives cache compatibility from normalized workspace identity and analysis-affecting settings', () => {
    const first = createWorkspaceInsightsCacheContext('C:\\Docs\\Project\\', {
      alpha: { enabled: true, severity: 'warning' },
      beta: { enabled: false, severity: 'error' },
    });
    const same = createWorkspaceInsightsCacheContext('C:/Docs/Project', {
      beta: { enabled: false, severity: 'error' },
      alpha: { enabled: true, severity: 'warning' },
    });
    const changed = createWorkspaceInsightsCacheContext('C:/Docs/Project', {
      alpha: { enabled: true, severity: 'error' },
      beta: { enabled: false, severity: 'error' },
    });

    expect(first.workspaceId).toBe(same.workspaceId);
    expect(first.analysisSignature).toBe(same.analysisSignature);
    expect(changed.analysisSignature).not.toBe(first.analysisSignature);
  });

  it('handles omitted history and propagates fingerprint into new or exact identity', () => {
    const withoutHistory = resolveWorkspaceIdentity({ workspacePath: '/isolated' });
    expect(withoutHistory.confidence).toBe('new');
    expect(withoutHistory.key).toMatch(/^workspace-[0-9a-f]{16}$/);

    const withFingerprint = resolveWorkspaceIdentity({ workspacePath: '/isolated', fingerprint: 'fp-1' });
    expect(withFingerprint.fingerprint).toBe('fp-1');

    const exactWithFp = resolveWorkspaceIdentity({
      workspacePath: '/exact',
      fingerprint: 'fp-2',
      history: [{ key: 'k-exact', path: '/exact' }],
    });
    expect(exactWithFp.key).toBe('k-exact');
    expect(exactWithFp.fingerprint).toBe('fp-2');
  });
});
