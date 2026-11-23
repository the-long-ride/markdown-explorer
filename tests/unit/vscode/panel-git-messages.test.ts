import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { handlePanelGitHistoryMessage } from '../../../vscode/src/core/panelGitHistory';

let root: string;
let markdown: string;
let oid: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-git-messages-'));
  markdown = path.join(root, 'notes.md');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(markdown, '# Original\n');
  fs.writeFileSync(path.join(root, 'image.png'), '');
  git('add', '--', 'notes.md', 'image.png');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=.', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Initial notes');
  oid = git('rev-parse', 'HEAD').trim();
  fs.writeFileSync(markdown, '# Modified\n');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

test('routes Git requests and matches revision, live source and history responses to their IDs', async () => {
  const post = vi.fn();
  const read = { oid, path: 'notes.md' };
  const snapshot = { ...read, source: '# Original\n' };
  const sides = { left: { kind: 'revision', ...read }, right: { kind: 'current', path: markdown } };
  const history = [expect.objectContaining({ oid, subject: 'Initial notes' })];
  const requests = [
    ['listDocumentHistory', { filePath: markdown }, 'documentHistoryResult', { revisions: history }],
    ['listRepositoryHistory', { allRefs: true }, 'repositoryHistoryResult', { commits: history }],
    ['listRevisionFiles', { oid }, 'revisionFilesResult', { files: [{ path: 'notes.md' }] }],
    ['readRevisionFile', read, 'revisionFileResult', { snapshot }],
    ['readGitRevision', read, 'gitRevisionResult', { snapshot }],
    ['compareGitRevisions', sides, 'gitComparisonResult', { leftSource: '# Original\n', rightSource: '# Modified\n' }],
  ] as const;
  for (const [command, fields, reply, expected] of requests) {
    expect(await handlePanelGitHistoryMessage({ command, requestId: command, ...fields }, root, post)).toBe(true);
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({
      command: reply, requestId: command, ok: true, ...expected,
    }));
  }
});

test('returns typed failures for every Git request when no workspace is open', async () => {
  const post = vi.fn();
  expect(await handlePanelGitHistoryMessage(undefined, undefined, post)).toBe(false);
  expect(await handlePanelGitHistoryMessage({ command: 'unrelated' }, root, post)).toBe(false);
  expect(post).not.toHaveBeenCalled();
  const commands = {
    listDocumentHistory: ['documentHistoryResult', { revisions: [] }],
    listRepositoryHistory: ['repositoryHistoryResult', { commits: [] }],
    listRevisionFiles: ['revisionFilesResult', { files: [] }],
    readRevisionFile: ['revisionFileResult', {}],
    readGitRevision: ['gitRevisionResult', {}],
    compareGitRevisions: ['gitComparisonResult', {}],
  } as const;
  for (const [command, [reply, fields]] of Object.entries(commands)) {
    expect(await handlePanelGitHistoryMessage({ command, requestId: 1, oid }, undefined, post)).toBe(true);
    expect(post).toHaveBeenLastCalledWith({ command: reply, requestId: '', ok: false, reason: 'not-repository', ...fields });
  }
});
