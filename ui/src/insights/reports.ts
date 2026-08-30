import type { WorkspaceInsightsSnapshot } from './index';

export type InsightsReportScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'paths'; readonly paths: readonly string[] };

export interface InsightsReportCompleteness {
  readonly provisional?: boolean;
  readonly truncated?: boolean;
  readonly warnings?: readonly string[];
}

export interface InsightsReportOptions {
  readonly scope?: InsightsReportScope;
  readonly completeness?: InsightsReportCompleteness;
  readonly generatedAt?: string;
}

function selectedPaths(snapshot: WorkspaceInsightsSnapshot, scope: InsightsReportScope | undefined): Set<string> {
  if (!scope || scope.kind === 'all') return new Set(snapshot.documents.keys());
  return new Set(scope.paths.filter(path => snapshot.documents.has(path)));
}

function lintSummary(document: WorkspaceInsightsSnapshot['documents'] extends ReadonlyMap<string, infer D> ? D : never) {
  const bySeverity: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  for (const finding of document.lint) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byRule[finding.ruleId] = (byRule[finding.ruleId] ?? 0) + 1;
  }
  return { total: document.lint.length, bySeverity, byRule };
}

function reportModel(snapshot: WorkspaceInsightsSnapshot, options: InsightsReportOptions) {
  const paths = selectedPaths(snapshot, options.scope);
  const documents = [...paths]
    .sort()
    .map(path => snapshot.documents.get(path)!)
    .map(document => ({
      path: document.path,
      title: document.title,
      aliases: [...document.aliases],
      tags: [...document.tags],
      headings: document.headings.map(heading => ({ text: heading.text, level: heading.level })),
      anchors: [...document.anchors].sort(),
      references: document.references.map(reference => ({
        kind: reference.kind,
        target: reference.target,
        ...(reference.fragment ? { fragment: reference.fragment } : {}),
        remote: reference.remote,
      })),
      dynamicReferenceCount: document.dynamicReferences.length,
      diagrams: document.diagrams.map(diagram => ({ kind: diagram.kind, status: diagram.status })),
      lint: lintSummary(document),
      exactFingerprint: document.exactFingerprint,
      terminologySignatures: [...document.terminologySignatures],
    }));

  const resolvedLinks = [...snapshot.outboundLinks.values()]
    .flat()
    .filter(link => paths.has(link.sourcePath))
    .map(link => ({
      sourcePath: link.sourcePath,
      targetPath: link.targetPath,
      kind: link.kind,
      ...(link.fragment ? { fragment: link.fragment } : {}),
      ...(link.caseMismatch ? { caseMismatch: true } : {}),
    }))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.targetPath.localeCompare(b.targetPath));

  const brokenLinks = snapshot.brokenLinks
    .filter(link => paths.has(link.sourcePath))
    .map(link => ({
      sourcePath: link.sourcePath,
      target: link.target,
      ...(link.fragment ? { fragment: link.fragment } : {}),
      status: link.status,
      ...(link.candidates ? { candidates: [...link.candidates] } : {}),
    }))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.target.localeCompare(b.target));

  const completeness = {
    provisional: options.completeness?.provisional === true,
    truncated: options.completeness?.truncated === true,
    warnings: [...(options.completeness?.warnings ?? [])],
  };

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: options.scope ?? { kind: 'all' as const },
    completeness,
    summary: {
      documentCount: documents.length,
      resolvedLinkCount: resolvedLinks.length,
      brokenLinkCount: brokenLinks.length,
    },
    documents,
    resolvedLinks,
    brokenLinks,
  };
}

export function createInsightsJsonReport(snapshot: WorkspaceInsightsSnapshot, options: InsightsReportOptions = {}): string {
  return `${JSON.stringify(reportModel(snapshot, options), null, 2)}\n`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function createInsightsMarkdownReport(snapshot: WorkspaceInsightsSnapshot, options: InsightsReportOptions = {}): string {
  const model = reportModel(snapshot, options);
  const status = model.completeness.provisional
    ? 'Provisional'
    : model.completeness.truncated || model.completeness.warnings.length
      ? 'Complete with warnings'
      : 'Complete';
  const lines: string[] = [
    '# Workspace Insights',
    '',
    `Status: **${status}**`,
    `Documents: **${model.summary.documentCount}**`,
    `Broken local links: **${model.summary.brokenLinkCount}**`,
    '',
  ];

  if (model.completeness.truncated) lines.push('> The workspace scan was truncated.', '');
  if (model.completeness.warnings.length) {
    lines.push('## Warnings', '');
    for (const warning of model.completeness.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push('## Documents', '', '| Path | Title | Tags | Headings | Links | Lint |', '| --- | --- | --- | ---: | ---: | ---: |');
  for (const document of model.documents) {
    lines.push(`| ${escapeCell(document.path)} | ${escapeCell(document.title)} | ${escapeCell(document.tags.join(', '))} | ${document.headings.length} | ${document.references.length} | ${document.lint.total} |`);
  }

  if (model.brokenLinks.length) {
    lines.push('', '## Broken links', '', '| Source | Target | Status |', '| --- | --- | --- |');
    for (const link of model.brokenLinks) {
      const target = `${link.target}${link.fragment ? `#${link.fragment}` : ''}`;
      lines.push(`| ${escapeCell(link.sourcePath)} | ${escapeCell(target)} | ${link.status} |`);
    }
  }

  return `${lines.join('\n')}\n`;
}
