import { existsSync } from 'node:fs';
import fg from 'fast-glob';
import { describe, expect, test } from 'vitest';
import { coverageManifest, productionGlobs, productionIgnore } from './coverage-manifest';
import { editorGitSplitCoverageManifest } from './editor-git-split-coverage-manifest';
import { exportScopeCoverageManifest } from './export-scope-coverage-manifest';
import { workspaceInsightsCoverageManifest } from './workspace-insights-coverage-manifest';

const effectiveCoverageManifest = {
  ...coverageManifest,
  ...editorGitSplitCoverageManifest,
  ...exportScopeCoverageManifest,
  ...workspaceInsightsCoverageManifest,
};

const repositorySnapshotAndIsolationSources = [
  'ui/src/history/gitGraphLayout.ts',
  'ui/src/contexts/RepositorySnapshotContext.tsx',
  'ui/src/components/History/GitCommitGraph.tsx',
  'ui/src/components/History/RepositoryHistoryPanel.tsx',
  'ui/src/components/History/RepositorySnapshotContent.tsx',
  'ui/src/components/History/RepositorySnapshotPortal.tsx',
  'ui/src/split-view/documentRenderRevision.ts',
] as const;

describe('coverage manifest', () => {
  test('maps every current production source exactly once', async () => {
    const actual = (await fg(productionGlobs, { ignore: productionIgnore })).sort();
    expect(Object.keys(effectiveCoverageManifest).sort()).toEqual(actual);
  });

  test('references existing test suites', () => {
    for (const suites of Object.values(effectiveCoverageManifest)) {
      expect(suites.length).toBeGreaterThan(0);
      for (const suite of suites) expect(existsSync(suite)).toBe(true);
    }
  });

  test('keeps repository snapshot and split render isolation sources under focused ownership', () => {
    for (const source of repositorySnapshotAndIsolationSources) {
      expect(editorGitSplitCoverageManifest[source], source).toBeDefined();
      expect(editorGitSplitCoverageManifest[source]?.length, source).toBeGreaterThan(0);
    }
  });
});