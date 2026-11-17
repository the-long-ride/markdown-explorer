import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURE_SLUG,
  FEATURE_DEMO_CATALOG,
  FEATURE_DEMO_CATEGORIES,
  getFeatureDemoItem,
  resolveFeatureSlug,
  type FeatureDemoCategory,
  type FeatureDemoSlug,
} from '../../../website-app/src/features/demoCatalog';
import {
  DEMO_DOCS,
  DEMO_FILES,
  DEMO_HTML_PREVIEW,
  DEMO_RECENT_WORKSPACES,
  DEMO_TREE,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_PATH,
  normalizeDemoDocPath,
} from '../../../website-app/src/features/demoMarkdownFixtures';
import {
  compareDemoGitRevisions,
  DEMO_FILE_COMMITS,
  DEMO_REPO_COMMITS,
  DEMO_REVISION_FILES,
  listDemoDocumentHistory,
  listDemoRepositoryHistory,
  listDemoRevisionFiles,
  readDemoGitRevision,
  readDemoRevisionFile,
} from '../../../website-app/src/features/demoGitFixtures';
import { createDemoInsightsSession } from '../../../website-app/src/features/demoInsightsFixture';
import { findDuplicateGroups } from '../../../ui/src/insights/duplicates';
import {
  buildRelationshipCandidates,
  RELATIONSHIP_PRESETS,
  scoreRelatedDocument,
} from '../../../ui/src/insights/relationships';

const EXPECTED_CATEGORIES: readonly FeatureDemoCategory[] = [
  'Workspace',
  'Reader & Data',
  'Authoring',
  'Audit & Git',
  'Productivity',
  'Personalization',
];

const EXPECTED_SLUGS: readonly FeatureDemoSlug[] = [
  'workspace-home',
  'sidebar-toc',
  'workspace',
  'tables-charts',
  'live-editor',
  'split-view',
  'insights',
  'git-diff',
  'search-bookmarks',
  'export-center',
  'themes-tabs',
];

describe('FEATURE_DEMO_CATALOG and resolveFeatureSlug', () => {
  it('defines all 11 feature demo items grouped across all 6 categories with valid default documents and highlights', () => {
    expect(DEFAULT_FEATURE_SLUG).toBe('workspace');
    expect(FEATURE_DEMO_CATEGORIES).toEqual(EXPECTED_CATEGORIES);
    expect(FEATURE_DEMO_CATALOG).toHaveLength(11);
    expect(FEATURE_DEMO_CATALOG.map((item) => item.slug)).toEqual(EXPECTED_SLUGS);

    const coveredCategories = new Set(FEATURE_DEMO_CATALOG.map((item) => item.category));
    expect(coveredCategories).toEqual(new Set(EXPECTED_CATEGORIES));

    for (const item of FEATURE_DEMO_CATALOG) {
      expect(EXPECTED_CATEGORIES).toContain(item.category);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.badge.length).toBeGreaterThan(0);
      expect(item.subtitle.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.highlights.length).toBeGreaterThanOrEqual(3);
      expect(DEMO_DOCS[item.defaultDocPath]).toBeDefined();
      expect(getFeatureDemoItem(item.slug)).toEqual(item);
    }
  });

  it('resolves all 11 canonical slugs and backward-compatible hero/spotlight aliases', () => {
    for (const slug of EXPECTED_SLUGS) {
      expect(resolveFeatureSlug(slug)).toBe(slug);
      expect(resolveFeatureSlug(`#${slug}`)).toBe(slug);
      expect(resolveFeatureSlug(`  ${slug.toUpperCase()}  `)).toBe(slug);
    }

    expect(resolveFeatureSlug('home')).toBe('workspace-home');
    expect(resolveFeatureSlug('launchpad')).toBe('workspace-home');
    expect(resolveFeatureSlug('toc-sidebar')).toBe('sidebar-toc');
    expect(resolveFeatureSlug('read')).toBe('sidebar-toc');
    expect(resolveFeatureSlug('markdown-rendering')).toBe('workspace');
    expect(resolveFeatureSlug('charts')).toBe('tables-charts');
    expect(resolveFeatureSlug('data')).toBe('tables-charts');
    expect(resolveFeatureSlug('editor')).toBe('live-editor');
    expect(resolveFeatureSlug('split')).toBe('split-view');
    expect(resolveFeatureSlug('split-editor')).toBe('split-view');
    expect(resolveFeatureSlug('insights-export')).toBe('insights');
    expect(resolveFeatureSlug('search')).toBe('insights');
    expect(resolveFeatureSlug('split-git')).toBe('git-diff');
    expect(resolveFeatureSlug('write')).toBe('git-diff');
    expect(resolveFeatureSlug('bookmarks')).toBe('search-bookmarks');
    expect(resolveFeatureSlug('export')).toBe('export-center');
    expect(resolveFeatureSlug('search-bookmarks-export')).toBe('export-center');
    expect(resolveFeatureSlug('themes')).toBe('themes-tabs');
    expect(resolveFeatureSlug('settings')).toBe('themes-tabs');
    expect(resolveFeatureSlug(null)).toBe('workspace');
    expect(resolveFeatureSlug(undefined)).toBe('workspace');
    expect(resolveFeatureSlug('non-existent-slug')).toBe('workspace');
  });
});

describe('DEMO_DOCS, recent workspaces, HTML preview, and Git fixtures', () => {
  it('provides rich markdown documents, files, folder tree, recent workspaces, and HTML preview', () => {
    expect(DEMO_WORKSPACE_NAME).toBe('markdown-explorer-demo');
    expect(DEMO_WORKSPACE_PATH).toBe('/workspace/markdown-explorer-demo');
    expect(Object.keys(DEMO_DOCS)).toEqual([
      'docs/architecture-overview.md',
      'docs/metrics-benchmarks.md',
      'docs/release-playbook.md',
      'docs/design-system-themes.md',
    ]);
    expect(DEMO_FILES).toHaveLength(4);
    expect(DEMO_TREE.name).toBe(DEMO_WORKSPACE_NAME);

    expect(DEMO_RECENT_WORKSPACES).toHaveLength(3);
    expect(DEMO_RECENT_WORKSPACES[0]?.path).toBe(DEMO_WORKSPACE_PATH);
    for (const ws of DEMO_RECENT_WORKSPACES) {
      expect(ws.name.length).toBeGreaterThan(0);
      expect(ws.docCount).toBeGreaterThan(0);
      expect(ws.lastOpened).toBeGreaterThan(0);
    }

    expect(DEMO_HTML_PREVIEW.path).toBe('docs/interactive-widget.html');
    expect(DEMO_HTML_PREVIEW.title.length).toBeGreaterThan(0);
    expect(DEMO_HTML_PREVIEW.htmlContent).toContain('<!doctype html>');

    expect(DEMO_DOCS['docs/architecture-overview.md'].markdown).toContain('```mermaid');
    expect(DEMO_DOCS['docs/metrics-benchmarks.md'].markdown).toContain('```csv');
    expect(DEMO_DOCS['docs/metrics-benchmarks.md'].markdown).toContain('```tsv');
    expect(DEMO_DOCS['docs/release-playbook.md'].oldMarkdown).toBeTruthy();
    expect(DEMO_DOCS['docs/release-playbook.md'].newMarkdown).toBeTruthy();
    expect(DEMO_DOCS['docs/release-playbook.md'].oldMarkdown).not.toBe(
      DEMO_DOCS['docs/release-playbook.md'].newMarkdown,
    );

    expect(normalizeDemoDocPath('metrics-benchmarks.md')).toBe('docs/metrics-benchmarks.md');
    expect(normalizeDemoDocPath('/workspace/markdown-explorer-demo/docs/release-playbook.md#release-pipeline')).toBe(
      'docs/release-playbook.md',
    );
    expect(normalizeDemoDocPath('missing.md')).toBe('docs/architecture-overview.md');
  });

  it('serves deterministic Git repository commits, file history, revisions, and comparison diffs', () => {
    expect(DEMO_REPO_COMMITS).toHaveLength(4);
    expect(DEMO_REPO_COMMITS[0]?.isHead).toBe(true);
    expect(DEMO_REVISION_FILES.map((f) => f.path)).toEqual(Object.keys(DEMO_DOCS));
    expect(Object.keys(DEMO_FILE_COMMITS)).toEqual(Object.keys(DEMO_DOCS));

    const limitedRepo = listDemoRepositoryHistory({ limit: 2 });
    expect(limitedRepo).toHaveLength(2);
    const pagedRepo = listDemoRepositoryHistory({ before: limitedRepo[1]!.oid, limit: 2 });
    expect(pagedRepo).toHaveLength(2);
    expect(pagedRepo[0]?.oid).toBe(DEMO_REPO_COMMITS[2]?.oid);

    const fileCommits = listDemoDocumentHistory('docs/release-playbook.md', 3);
    expect(fileCommits).toHaveLength(3);

    const headOid = DEMO_REPO_COMMITS[0]!.oid;
    const baseOid = DEMO_REPO_COMMITS[3]!.oid;
    const oldSnapshot = readDemoGitRevision(baseOid, 'docs/release-playbook.md');
    const newSnapshot = readDemoRevisionFile(headOid, 'docs/release-playbook.md');
    expect(oldSnapshot.source).not.toBe(newSnapshot.source);
    expect(listDemoRevisionFiles(headOid)).toEqual(DEMO_REVISION_FILES);

    const currentSources = new Map([['docs/release-playbook.md', DEMO_DOCS['docs/release-playbook.md'].markdown]]);
    const diff = compareDemoGitRevisions(
      { kind: 'commit', oid: baseOid, path: 'docs/release-playbook.md' },
      { kind: 'current', path: 'docs/release-playbook.md' },
      currentSources,
    );
    expect(diff.leftSource).toBe(oldSnapshot.source);
    expect(diff.rightSource).toBe(DEMO_DOCS['docs/release-playbook.md'].markdown);
    expect(diff.rightLabel).toBe('Working Tree (Current)');
  });
});

describe('createDemoInsightsSession', () => {
  it('populates real analyzer-backed data across all 6 Workspace Insights views', async () => {
    const session = createDemoInsightsSession('gallery');
    expect(session.panelOpen).toBe(true);
    expect(session.status).toBe('ready');

    const docs = [...session.snapshot.documents.values()];
    expect(docs).toHaveLength(4);

    // 1. Gallery view: diagrams present
    const totalDiagrams = docs.reduce((sum, doc) => sum + doc.diagrams.length, 0);
    expect(totalDiagrams).toBeGreaterThan(0);

    // 2. Links view: resolved outbound links, backlinks, and broken link
    expect(session.snapshot.outboundLinks.size).toBeGreaterThan(0);
    expect(session.snapshot.backlinks.size).toBeGreaterThan(0);
    expect(session.snapshot.brokenLinks.length).toBeGreaterThan(0);
    expect(session.snapshot.brokenLinks.some((link) => link.target.includes('legacy-roadmap.md'))).toBe(true);

    // 3. Lint view: at least one lint finding (e.g. skipped heading level)
    const totalLint = docs.reduce((sum, doc) => sum + doc.lint.length, 0);
    expect(totalLint).toBeGreaterThan(0);

    // 4. Duplicates view: shared section fingerprint across release-playbook & design-system-themes
    const sectionFingerprints = new Map<string, number>();
    for (const doc of docs) {
      for (const section of doc.sections) {
        if (section.text.length >= 100) {
          sectionFingerprints.set(section.fingerprint, (sectionFingerprints.get(section.fingerprint) ?? 0) + 1);
        }
      }
    }
    const repeatedSections = [...sectionFingerprints.values()].filter((count) => count > 1);
    const nearDuplicates = findDuplicateGroups(
      docs.map((doc) => ({ path: doc.path, normalizedTokens: doc.terminology })),
      { threshold: 0.9 },
    );
    expect(repeatedSections.length + nearDuplicates.length).toBeGreaterThan(0);

    // 5. Graph view: nodes and edges from snapshot
    const totalEdges = [...session.snapshot.outboundLinks.values()].reduce(
      (sum, edges) => sum + edges.length,
      0,
    );
    expect(session.snapshot.documents.size).toBe(4);
    expect(totalEdges).toBeGreaterThan(0);

    // 6. Related view: relationship scoring finds related documents for architecture-overview
    const relDocs = docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      tags: doc.tags,
      headings: doc.headings.map((h) => h.text),
      links: doc.references
        .filter((r) => !r.remote && r.kind !== 'media' && r.kind !== 'html-media')
        .map((r) => r.target),
      terms: doc.terminology,
      terminologySignatures: doc.terminologySignatures,
    }));
    const candidates = buildRelationshipCandidates(relDocs);
    const source = relDocs.find((d) => d.path === 'docs/architecture-overview.md')!;
    const relatedScores = relDocs
      .filter((d) => d.path !== source.path)
      .map((target) => scoreRelatedDocument(source, target, candidates, RELATIONSHIP_PRESETS.default))
      .filter((score) => score.score > 0);
    expect(relatedScores.length).toBeGreaterThan(0);

    // Wiki resolver and external check helpers
    const wikiCtx = await session.getWikiResolverContext('docs/architecture-overview.md');
    expect(wikiCtx.documents.length).toBe(4);
    const checkResults = await session.checkExternalLinks(['https://example.com']);
    expect(checkResults[0]?.status).toBe('reachable');
  });
});
