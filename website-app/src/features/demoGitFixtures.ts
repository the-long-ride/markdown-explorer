// =============================================================================
// website-app/src/features/demoGitFixtures.ts
// Realistic Git commit history, revision snapshots, and diff resolution.
// =============================================================================

import type {
  GitCompareSide,
  GitComparisonSources,
  GitRepositoryCommit,
  GitRevisionFile,
  GitRevisionFileSnapshot,
  GitRevisionSnapshot,
  GitRevisionSummary,
} from '../../../ui/src/history/contracts';
import { DEMO_DOCS, normalizeDemoDocPath } from './demoMarkdownFixtures';

const BASE_TIMESTAMP = 1731880000000;

export const DEMO_REPO_COMMITS: readonly GitRepositoryCommit[] = [
  {
    oid: '7f4a92c81d4e2a10f9c3b8e4a1d5f20c9b8a1e77',
    shortOid: '7f4a92c',
    parentOids: ['5d2c19a34b6e18c7d9024f11a8b6c3d5e7f90122'],
    author: 'Markdown Explorer CI',
    authoredAt: new Date(BASE_TIMESTAMP - 2 * 3600 * 1000).toISOString(),
    subject: 'feat(release): add Rust Tauri bundles & live web feature studio',
    refs: ['HEAD -> main', 'tag: v1.7.2'],
    isHead: true,
  },
  {
    oid: '5d2c19a34b6e18c7d9024f11a8b6c3d5e7f90122',
    shortOid: '5d2c19a',
    parentOids: ['3b18e04f92c1b7a5e830d6f4c2a1b9e8d7c60511'],
    author: 'Long Trinh',
    authoredAt: new Date(BASE_TIMESTAMP - 26 * 3600 * 1000).toISOString(),
    subject: 'feat(themes): expand design system with 9 curated & pet themes',
    refs: [],
    isHead: false,
  },
  {
    oid: '3b18e04f92c1b7a5e830d6f4c2a1b9e8d7c60511',
    shortOid: '3b18e04',
    parentOids: ['1a90f4e12c8b34d56e78f90a1b2c3d4e5f607899'],
    author: 'Long Trinh',
    authoredAt: new Date(BASE_TIMESTAMP - 54 * 3600 * 1000).toISOString(),
    subject: 'docs(metrics): add TSV platform matrix and Chart.js benchmark table',
    refs: ['origin/main'],
    isHead: false,
  },
  {
    oid: '1a90f4e12c8b34d56e78f90a1b2c3d4e5f607899',
    shortOid: '1a90f4e',
    parentOids: [],
    author: 'Markdown Explorer CI',
    authoredAt: new Date(BASE_TIMESTAMP - 96 * 3600 * 1000).toISOString(),
    subject: 'docs(core): initial workspace architecture & release baseline',
    refs: ['tag: v1.7.0'],
    isHead: false,
  },
];

export const DEMO_REVISION_FILES: readonly GitRevisionFile[] = Object.keys(DEMO_DOCS).map(
  (path) => ({ path }),
);

const RELEASE_V1_MD =
  DEMO_DOCS['docs/release-playbook.md'].oldMarkdown ??
  DEMO_DOCS['docs/release-playbook.md'].markdown;

const RELEASE_MID_MD = RELEASE_V1_MD.replace(
  '3. Build Electron installers for Windows and macOS.',
  '3. Build Electron installers for Windows and macOS.\n4. Validate cross-platform Tauri preview builds.',
);

const ARCH_OLD_MD = DEMO_DOCS['docs/architecture-overview.md'].markdown.replace(
  'across **Tauri**, **Electron**, **VS Code**, and the **Browser**.',
  'across **Electron**, **VS Code**, and the **Browser**.',
);

const METRICS_OLD_MD = DEMO_DOCS['docs/metrics-benchmarks.md'].markdown.replace(
  '| Browser Web App | 140 | 31 | 1.8 | 22 | Yes |\n',
  '',
);

const THEMES_OLD_MD = DEMO_DOCS['docs/design-system-themes.md'].markdown.replace(
  '| `pet-white-shiba` | Playful Shiba companion accents | 12px | Cozy Apricot |\n',
  '',
);

function sourceForRevision(oid: string, rawPath: string): string {
  const path = normalizeDemoDocPath(rawPath);
  const current = DEMO_DOCS[path]?.markdown ?? '';
  const short = oid.slice(0, 7);

  if (path === 'docs/release-playbook.md') {
    if (short === '1a90f4e' || short === '3b18e04') return RELEASE_V1_MD;
    if (short === '5d2c19a') return RELEASE_MID_MD;
    return current;
  }
  if (path === 'docs/architecture-overview.md') {
    return short === '1a90f4e' ? ARCH_OLD_MD : current;
  }
  if (path === 'docs/metrics-benchmarks.md') {
    return short === '1a90f4e' ? METRICS_OLD_MD : current;
  }
  if (path === 'docs/design-system-themes.md') {
    return short === '1a90f4e' || short === '3b18e04' ? THEMES_OLD_MD : current;
  }
  return current;
}

export const DEMO_FILE_COMMITS: Record<string, readonly GitRevisionSummary[]> = Object.fromEntries(
  Object.keys(DEMO_DOCS).map((path) => [
    path,
    DEMO_REPO_COMMITS.map((commit) => ({
      oid: commit.oid,
      shortOid: commit.shortOid,
      author: commit.author,
      authoredAt: commit.authoredAt,
      subject: commit.subject,
      path,
    })),
  ]),
);

export function listDemoDocumentHistory(
  filePath: string,
  limit?: number,
): readonly GitRevisionSummary[] {
  const path = normalizeDemoDocPath(filePath);
  const items = DEMO_FILE_COMMITS[path] ?? DEMO_FILE_COMMITS['docs/release-playbook.md'];
  return typeof limit === 'number' && limit > 0 ? items.slice(0, limit) : items;
}

export function readDemoGitRevision(oid: string, filePath: string): GitRevisionSnapshot {
  const path = normalizeDemoDocPath(filePath);
  return {
    oid,
    path,
    source: sourceForRevision(oid, path),
  };
}

export function compareDemoGitRevisions(
  left: GitCompareSide,
  right: GitCompareSide,
  currentSources: ReadonlyMap<string, string>,
): GitComparisonSources {
  const resolveSide = (side: GitCompareSide): { source: string; label: string } => {
    const path = normalizeDemoDocPath(side.path);
    if (side.kind === 'current') {
      return {
        source: currentSources.get(path) ?? DEMO_DOCS[path]?.markdown ?? '',
        label: 'Working Tree (Current)',
      };
    }
    const commit = DEMO_REPO_COMMITS.find(
      (c) => c.oid === side.oid || c.shortOid === side.oid.slice(0, 7),
    );
    const short = commit?.shortOid ?? side.oid.slice(0, 7);
    return {
      source: sourceForRevision(side.oid, path),
      label: commit ? `${short} (${commit.subject.slice(0, 32)})` : short,
    };
  };

  const resolvedLeft = resolveSide(left);
  const resolvedRight = resolveSide(right);
  return {
    leftSource: resolvedLeft.source,
    rightSource: resolvedRight.source,
    leftLabel: resolvedLeft.label,
    rightLabel: resolvedRight.label,
  };
}

export function listDemoRepositoryHistory(options?: {
  limit?: number;
  offset?: number;
  before?: string;
}): readonly GitRepositoryCommit[] {
  let start = options?.offset ?? 0;
  if (options?.before) {
    const idx = DEMO_REPO_COMMITS.findIndex((c) => c.oid === options.before);
    if (idx >= 0) start = idx + 1;
  }
  const limit = options?.limit ?? DEMO_REPO_COMMITS.length;
  return DEMO_REPO_COMMITS.slice(start, start + limit);
}

export function listDemoRevisionFiles(oid: string): readonly GitRevisionFile[] {
  void oid;
  return DEMO_REVISION_FILES;
}

export function readDemoRevisionFile(oid: string, filePath: string): GitRevisionFileSnapshot {
  const path = normalizeDemoDocPath(filePath);
  return {
    oid,
    path,
    source: sourceForRevision(oid, path),
  };
}
