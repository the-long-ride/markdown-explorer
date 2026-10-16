import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ignoredFolderNamesFromGlobs, listEmptyDirectories } from '../../../vscode/src/core/emptyDirectories';
import { WorkspaceScanner } from '../../../vscode/src/core/scanner';
import { scanWorkspaceIncrementally } from '../../../vscode/src/core/incrementalScan';
import { DEFAULT_WORKSPACE_EXCLUDE_PATTERNS } from '../../../vscode/src/constants/workspace';

const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('VS Code empty directories', () => {
  it('derives folder names from simple exclude globs', () => {
    expect(ignoredFolderNamesFromGlobs(['**/node_modules/**', '**/.git', '**/*.log', 'out/**'])).toEqual(['node_modules', '.git']);
    expect(ignoredFolderNamesFromGlobs(DEFAULT_WORKSPACE_EXCLUDE_PATTERNS)).toContain('node_modules');
  });

  it('lists only zero-entry folders outside ignored names', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-empty-'));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'blank'));
    fs.mkdirSync(path.join(root, 'outer', 'inner'), { recursive: true });
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets', 'logo.png'), 'picture');
    fs.mkdirSync(path.join(root, 'node_modules', 'empty'), { recursive: true });
    expect(await listEmptyDirectories(root, ['node_modules'])).toEqual(['blank', 'outer/inner']);
  });

  it('returns [] when the root cannot be read', async () => {
    expect(await listEmptyDirectories(path.join(os.tmpdir(), 'missing-root-for-test'), [])).toEqual([]);
  });

  it('builds empty folder nodes and detects them', () => {
    const tree = WorkspaceScanner.buildTree([], ['outer/inner']);
    expect(tree.children[0].path).toBe('outer');
    expect(tree.children[0].children[0].path).toBe('outer/inner');
    expect(WorkspaceScanner.hasEmptyFolder(tree)).toBe(true);
    expect(WorkspaceScanner.hasEmptyFolder(WorkspaceScanner.buildTree([]))).toBe(false);
  });
});

describe('VS Code incremental scan with empty folders', () => {
  const file = WorkspaceScanner.buildFileEntry('/ws/docs/a.md', '/ws');

  async function runRevealedScan(emptyDirs: string[]) {
    vi.useFakeTimers();
    let finish!: (value: { tree: ReturnType<typeof WorkspaceScanner.buildTree>; flat: typeof file[] }) => void;
    const gate = new Promise<{ tree: ReturnType<typeof WorkspaceScanner.buildTree>; flat: typeof file[] }>((resolve) => { finish = resolve; });
    vi.spyOn(WorkspaceScanner, 'scan').mockImplementation((_conversion, _progress, onFile) => {
      onFile?.(file, 1);
      return gate;
    });
    const onReveal = vi.fn();
    const onChanged = vi.fn();
    const pending = scanWorkspaceIncrementally({
      documentConversionEnabled: false,
      isCurrent: () => true,
      onProgress: () => {},
      onReveal,
      onChanged,
    });
    await vi.advanceTimersByTimeAsync(3000);
    finish({ tree: WorkspaceScanner.buildTree([file], emptyDirs), flat: [file] });
    await pending;
    return { onReveal, onChanged };
  }

  it('forces a final publish when the final tree carries an empty folder', async () => {
    const { onReveal, onChanged } = await runRevealedScan(['blank']);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal.mock.calls[0][0].tree.children.map((c: { path: string }) => c.path)).toEqual(['docs']);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged.mock.calls[0][0].tree.children.map((c: { path: string }) => c.path)).toEqual(['docs', 'blank']);
  });

  it('skips the final publish when nothing changed and no folder is empty', async () => {
    const { onChanged } = await runRevealedScan([]);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
