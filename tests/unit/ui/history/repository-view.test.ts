import { describe, expect, it } from 'vitest';
import {
  filterRepositoryCommits,
  readPersistedRevision,
  repositoryWorkspaceKey,
  writePersistedRevision,
} from '../../../../ui/src/history/repositoryView';
import type { GitRepositoryCommit } from '../../../../ui/src/history/contracts';

const commits: readonly GitRepositoryCommit[] = [
  {
    oid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    shortOid: 'aaaaaaa',
    parentOids: [],
    author: 'Alice Example',
    authoredAt: '2026-09-16T00:00:00Z',
    subject: 'Add split pane tabs',
    refs: ['HEAD -> main'],
    isHead: true,
  },
  {
    oid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    shortOid: 'bbbbbbb',
    parentOids: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    author: 'Bob Builder',
    authoredAt: '2026-09-15T00:00:00Z',
    subject: 'Fix parser regression',
    refs: [],
    isHead: false,
  },
];

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

  it('filters commits by full or short sha, author, and commit message', () => {
    expect(filterRepositoryCommits(commits, 'aaaaaaa')).toEqual([commits[0]]);
    expect(filterRepositoryCommits(commits, 'AAAAAAAAAAAAAAAA')).toEqual([commits[0]]);
    expect(filterRepositoryCommits(commits, 'alice')).toEqual([commits[0]]);
    expect(filterRepositoryCommits(commits, 'parser regression')).toEqual([commits[1]]);
    expect(filterRepositoryCommits(commits, '')).toEqual(commits);
  });
});
