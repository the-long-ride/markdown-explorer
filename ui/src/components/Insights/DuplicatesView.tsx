import { useMemo, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import { findDuplicateGroups, normalizeDuplicateTokens, type DuplicateGroup } from '../../insights/duplicates';

export interface DuplicatesViewProps {
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations;
  readonly threshold?: number;
  readonly suppressions?: readonly string[];
  readonly onSuppressionsChange?: (next: readonly string[]) => void;
}

function analyzedGroups(documents: readonly AnalyzedDocument[], threshold: number): DuplicateGroup[] {
  const result: DuplicateGroup[] = [];
  const exact = new Map<string, string[]>();
  for (const document of documents) {
    const paths = exact.get(document.exactFingerprint) ?? [];
    paths.push(document.path);
    exact.set(document.exactFingerprint, paths);
  }
  for (const [fingerprint, paths] of exact) {
    const unique = [...new Set(paths)].sort();
    if (unique.length > 1) result.push({ key: `exact:${fingerprint}`, kind: 'exact', paths: unique, fingerprint });
  }

  const sections = new Map<string, string[]>();
  for (const document of documents) for (const section of document.sections) {
    if (section.text.length < 100 || normalizeDuplicateTokens(section.text).length < 20) continue;
    const paths = sections.get(section.fingerprint) ?? [];
    paths.push(document.path);
    sections.set(section.fingerprint, paths);
  }
  for (const [fingerprint, paths] of sections) {
    const unique = [...new Set(paths)].sort();
    if (unique.length > 1) result.push({ key: `section:${fingerprint}`, kind: 'section', paths: unique, fingerprint });
  }

  const exactPairs = new Set<string>();
  for (const group of result.filter(group => group.kind === 'exact')) {
    for (let i = 0; i < group.paths.length; i += 1) for (let j = i + 1; j < group.paths.length; j += 1) exactPairs.add([group.paths[i], group.paths[j]].sort().join('\u0000'));
  }
  const near = findDuplicateGroups(
    documents.map(document => ({ path: document.path, normalizedTokens: document.terminology })),
    { threshold },
  ).filter(group => group.kind === 'near' && !exactPairs.has([...group.paths].sort().join('\u0000')));
  result.push(...near);
  return result.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
}

function labelFor(group: DuplicateGroup, labels: InsightsTranslations): string {
  if (group.kind === 'exact') return labels.exactDuplicate;
  if (group.kind === 'section' || group.kind === 'passage') return labels.repeatedSection;
  return labels.nearDuplicate;
}

function format(value: string, key: string, replacement: string | number): string {
  return value.replace(`{${key}}`, String(replacement));
}

export function DuplicatesView({ documents, labels = INSIGHTS_TRANSLATIONS.en, threshold = 0.9, suppressions, onSuppressionsChange }: DuplicatesViewProps) {
  const groups = useMemo(() => analyzedGroups(documents, threshold), [documents, threshold]);
  const [localSuppressed, setLocalSuppressed] = useState<Set<string>>(() => new Set());
  const [showSuppressed, setShowSuppressed] = useState(false);
  const controlled = suppressions !== undefined;
  const suppressed = useMemo(() => controlled ? new Set(suppressions) : localSuppressed, [controlled, localSuppressed, suppressions]);
  const visible = groups.filter(group => showSuppressed || !suppressed.has(group.key));

  const updateSuppressed = (next: Set<string>) => {
    const values = [...next].sort();
    if (!controlled) setLocalSuppressed(next);
    onSuppressionsChange?.(values);
  };

  return (
    <div className="insights-duplicates">
      <div className="insights-view-summary">{format(labels.nearDuplicateThreshold, 'percent', Math.round(threshold * 100))}</div>
      {suppressed.size > 0 && <button type="button" className="btn btn--sm" onClick={() => setShowSuppressed(value => !value)}>{showSuppressed ? labels.hideSuppressed : labels.showSuppressed}</button>}
      {!visible.length && <div className="workspace-insights__empty">{labels.noDuplicateGroups}</div>}
      <ul className="insights-list">
        {visible.map(group => {
          const hidden = suppressed.has(group.key);
          return (
            <li key={group.key} className={`insights-list__row${hidden ? ' is-suppressed' : ''}`}>
              <div><strong>{labelFor(group, labels)}</strong><span>{group.paths.join(' · ')}{group.score !== undefined ? ` · ${Math.round(group.score * 100)}%` : ''}</span>{hidden && <em>{labels.suppressed}</em>}</div>
              {hidden ? (
                <button type="button" className="btn btn--sm" onClick={() => { const next = new Set(suppressed); next.delete(group.key); updateSuppressed(next); }}>{labels.restoreGroup}</button>
              ) : (
                <button type="button" className="btn btn--sm" aria-label={`${labels.suppress} ${labels.duplicates}`} onClick={() => { const next = new Set(suppressed); next.add(group.key); updateSuppressed(next); }}>{labels.suppress}</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
