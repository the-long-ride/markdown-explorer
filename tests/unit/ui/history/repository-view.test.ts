import { describe, expect, it } from 'vitest';
import {
  readPersistedRevision,
  repositoryWorkspaceKey,
  writePersistedRevision,
} from '../../../../ui/src/history/repositoryView';

describe('repository view persistence helpers', () => {
  it('prefers workspace path and falls back to workspace name', () => {
    expect(repositoryWorkspaceKey(' C:/repo ', 'repo')).toBe('C:/repo');
    expect(repositoryWorkspaceKey(undefined, ' repo ')).toBe('repo');
    expect(repositoryWorkspaceKey('', '')).toBe('');
  });

  it('keeps selections isolated by workspace and clears one without affecting others', () => {
    const one = writePersistedRevision(undefined, 'A', 'abc');
    const two = writePersistedRevision(one, 'B', 'def');
    expect(readPersistedRevision(two, 'A')).toBe('abc');
    expect(readPersistedRevision(two, 'B')).toBe('def');

    const cleared = writePersistedRevision(two, 'A', null);
    expect(readPersistedRevision(cleared, 'A')).toBeNull();
    expect(readPersistedRevision(cleared, 'B')).toBe('def');
  });
});
