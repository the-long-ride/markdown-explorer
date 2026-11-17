import type { InsightsLintFinding } from './lint';
import type { DuplicateGroup } from './duplicates';
import type { WorkspaceInsightsSnapshot, BrokenInsightsLink } from './index';
import type { InsightsTranslations } from '../contexts/insightsTranslations';
import { insightsLintRuleLabel, type InsightsUiTranslations } from '../contexts/insightsUiTranslations';

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  } catch {}
  return false;
}

export function buildLintAiPrompt(
  findings: readonly InsightsLintFinding[],
  labels?: InsightsTranslations | InsightsUiTranslations,
): string {
  if (!findings.length) {
    return 'No markdown lint failures detected in the workspace.';
  }

  const filesMap = new Map<string, InsightsLintFinding[]>();
  for (const f of findings) {
    const list = filesMap.get(f.path) ?? [];
    list.push(f);
    filesMap.set(f.path, list);
  }

  const sortedPaths = [...filesMap.keys()].sort();
  const fileSections: string[] = [];

  for (const path of sortedPaths) {
    const fileFindings = filesMap.get(path)!;
    const ruleMap = new Map<string, InsightsLintFinding[]>();
    for (const f of fileFindings) {
      const list = ruleMap.get(f.ruleId) ?? [];
      list.push(f);
      ruleMap.set(f.ruleId, list);
    }

    const sortedRules = [...ruleMap.keys()].sort();
    const ruleSections: string[] = [];

    for (const ruleId of sortedRules) {
      const rf = ruleMap.get(ruleId)!;
      rf.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
      const ruleLabel = labels ? insightsLintRuleLabel(labels as InsightsUiTranslations, ruleId) : ruleId;
      const severity = rf[0]?.severity ?? 'warning';
      const lines = rf.map(item => `  - Line ${item.line ?? '?'}: ${item.message || ruleLabel}`);
      ruleSections.push(`- [${ruleLabel}] (\`${ruleId}\`, ${severity}):\n${lines.join('\n')}`);
    }

    fileSections.push(`### File: \`${path}\`\n${ruleSections.join('\n')}`);
  }

  return [
    'You are an expert technical writer and software engineer.',
    'Please fix the following markdown lint issues in the workspace. Grouped by file, sorted by error type, with all line failures listed:',
    '',
    ...fileSections,
    '',
    'Instructions:',
    '1. Fix each lint failure in its respective file according to standard Markdown specification.',
    '2. Preserve existing document structure, valid headings, formatting, and docstrings.',
    '3. Ensure tables, lists, and frontmatter are syntactically well-formed.',
  ].join('\n');
}

export function buildGraphAiPrompt(
  snapshot: WorkspaceInsightsSnapshot,
  _labels?: InsightsTranslations | InsightsUiTranslations,
): string {
  const brokenLinks = snapshot.brokenLinks ?? [];
  const documents = [...snapshot.documents.values()];

  const syntaxFindings = documents.flatMap(d =>
    d.lint.filter(f =>
      f.ruleId.startsWith('wiki/') ||
      f.ruleId.startsWith('link/') ||
      f.ruleId.startsWith('mermaid/')
    )
  );

  const caseMismatches: { source: string; target: string }[] = [];
  for (const [source, links] of snapshot.outboundLinks.entries()) {
    for (const l of links) {
      if (l.caseMismatch) caseMismatches.push({ source, target: l.targetPath });
    }
  }

  const orphans = documents
    .map(d => d.path)
    .filter(path => {
      const out = snapshot.outboundLinks.get(path)?.length ?? 0;
      const back = snapshot.backlinks.get(path)?.length ?? 0;
      return out === 0 && back === 0;
    })
    .sort();

  const hasIssues = brokenLinks.length > 0 || syntaxFindings.length > 0 || caseMismatches.length > 0 || orphans.length > 0;
  if (!hasIssues) {
    return 'All links, references, and diagram syntax in the workspace graph resolve cleanly with no syntax errors or broken links detected.';
  }

  const sections: string[] = [
    'You are an expert technical writer and software engineer.',
    'Please fix the broken links, invalid link/diagram syntax, and graph connection issues in this workspace:',
    '',
  ];

  if (brokenLinks.length > 0) {
    sections.push(`### Broken Links & Unresolved References (${brokenLinks.length})`);
    const brokenMap = new Map<string, BrokenInsightsLink[]>();
    for (const bl of brokenLinks) {
      const list = brokenMap.get(bl.sourcePath) ?? [];
      list.push(bl);
      brokenMap.set(bl.sourcePath, list);
    }
    for (const [source, list] of [...brokenMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      sections.push(`- In \`${source}\`:`);
      for (const bl of list) {
        const frag = bl.fragment ? `#${bl.fragment}` : '';
        const cands = bl.candidates?.length ? ` (did you mean: ${bl.candidates.map(c => `\`${c}\``).join(', ')}?)` : '';
        sections.push(`  - Target: \`${bl.target}${frag}\` — Status: ${bl.status}${cands}`);
      }
    }
    sections.push('');
  }

  if (syntaxFindings.length > 0) {
    sections.push(`### Syntax Errors in Links & Graph Diagrams (${syntaxFindings.length})`);
    const synMap = new Map<string, InsightsLintFinding[]>();
    for (const f of syntaxFindings) {
      const list = synMap.get(f.path) ?? [];
      list.push(f);
      synMap.set(f.path, list);
    }
    for (const [path, list] of [...synMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      sections.push(`- In \`${path}\`:`);
      for (const f of list) {
        sections.push(`  - Line ${f.line ?? '?'}: [${f.ruleId}] ${f.message}`);
      }
    }
    sections.push('');
  }

  if (caseMismatches.length > 0) {
    sections.push(`### Path Casing Mismatches (${caseMismatches.length})`);
    for (const cm of caseMismatches) {
      sections.push(`- In \`${cm.source}\`: Link references \`${cm.target}\` with mismatched casing.`);
    }
    sections.push('');
  }

  if (orphans.length > 0) {
    sections.push(`### Orphan Documents Disconnected From Graph (${orphans.length})`);
    for (const orphan of orphans) {
      sections.push(`- \`${orphan}\`: Has no incoming or outgoing links connecting it to the workspace graph.`);
    }
    sections.push('');
  }

  sections.push(
    'Instructions:',
    '1. Correct all broken link targets and invalid anchor fragments so every reference resolves to an existing file/heading.',
    '2. Fix malformed Wiki link syntax, URIs, and Mermaid diagram syntax so diagrams and links parse properly.',
    '3. Fix casing mismatches to ensure cross-platform compatibility.',
    '4. Link orphan documents to relevant hub or overview documents where appropriate.',
  );

  return sections.join('\n');
}

export function buildDuplicatesAiPrompt(
  groups: readonly DuplicateGroup[],
  _labels?: InsightsTranslations | InsightsUiTranslations,
): string {
  if (!groups.length) {
    return 'No duplicate documents or repeated sections detected in this workspace.';
  }

  const exact = groups.filter(g => g.kind === 'exact');
  const section = groups.filter(g => g.kind === 'section' || g.kind === 'passage');
  const near = groups.filter(g => g.kind === 'near');

  const sections: string[] = [
    'You are an expert technical writer and software engineer.',
    'Please review the following potential duplicate documents and sections detected in this workspace:',
    '',
  ];

  if (exact.length > 0) {
    sections.push(`### Exact Duplicates (100% Identical Content) (${exact.length} group${exact.length > 1 ? 's' : ''})`);
    exact.forEach((g, idx) => {
      sections.push(`- Group ${idx + 1}:`);
      for (const p of g.paths) sections.push(`  - \`${p}\``);
    });
    sections.push('');
  }

  if (section.length > 0) {
    sections.push(`### Section & Repeated Passage Duplicates (${section.length} group${section.length > 1 ? 's' : ''})`);
    section.forEach((g, idx) => {
      sections.push(`- Group ${idx + 1}:`);
      for (const p of g.paths) sections.push(`  - \`${p}\``);
    });
    sections.push('');
  }

  if (near.length > 0) {
    sections.push(`### Near Duplicates (${near.length} group${near.length > 1 ? 's' : ''})`);
    near.forEach((g, idx) => {
      const scorePct = g.score !== undefined ? `${Math.round(g.score * 100)}%` : 'high';
      sections.push(`- Group ${idx + 1} (${scorePct} similarity):`);
      for (const p of g.paths) sections.push(`  - \`${p}\``);
    });
    sections.push('');
  }

  sections.push(
    'Instructions for AI Agent:',
    '1. Double-check and brainstorm each candidate group: verify whether they are actual duplicates, redundant copies, outdated versions, or intentionally separate documents (e.g. templates, translations, distinct guides).',
    '2. For true duplicates: consolidate them into a single canonical document, update all links/references across the workspace to point to the canonical version, and remove or repurpose redundant files.',
    '3. For repeated sections or near-duplicates: extract shared content into reusable markdown components or clarify distinct document purposes to eliminate confusion.',
    '4. Provide a clear summary of all brainstormed conclusions, decisions, and fixes applied.',
  );

  return sections.join('\n');
}
