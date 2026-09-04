import { useMemo, useState } from 'react';
import type { InsightsTranslations } from '../../contexts/insightsTranslations';
import { ensureInsightsUiTranslations, insightsStatusLabel, type InsightsPresentationStatus, type InsightsUiTranslations } from '../../contexts/insightsUiTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import type { ExternalLinkCheckResult } from '../../insights/contracts';
import type { WorkspaceInsightsSnapshot } from '../../insights/index';
import type { JumpLocation } from '../../insights/jumpToLocation';

export interface LinksViewProps {
  readonly snapshot: WorkspaceInsightsSnapshot;
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations | InsightsUiTranslations;
  readonly externalResults: ReadonlyMap<string, ExternalLinkCheckResult>;
  readonly externalCheckingEnabled?: boolean;
  readonly externalChecking?: boolean;
  readonly onCheckExternalLinks?: (urls: readonly string[], options?: { readonly recheck?: boolean }) => Promise<readonly ExternalLinkCheckResult[] | void>;
  readonly onCancelExternalChecks?: () => void;
  readonly onSelectPath?: (path: string, location?: JumpLocation) => void;
}

interface LinkRow {
  readonly key: string;
  readonly sourcePath: string;
  readonly target: string;
  readonly status: InsightsPresentationStatus;
  readonly broken: boolean;
  readonly checkedAt?: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

function format(value: string, replacements: Readonly<Record<string, string | number>>): string {
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)), value);
}

export function LinksView({
  snapshot,
  documents,
  labels: suppliedLabels,
  externalResults,
  externalCheckingEnabled = false,
  externalChecking = false,
  onCheckExternalLinks,
  onCancelExternalChecks,
  onSelectPath,
}: LinksViewProps) {
  const labels = ensureInsightsUiTranslations(suppliedLabels);
  const externalUrls = useMemo(() => [...new Set(documents.flatMap(document => document.references.filter(reference => reference.remote).map(reference => reference.target)))].sort(), [documents]);
  const [checking, setChecking] = useState(false);
  const isChecking = externalChecking || checking;

  const rows = useMemo<LinkRow[]>(() => {
    const result: LinkRow[] = snapshot.brokenLinks.map(link => ({
      key: `broken:${link.sourcePath}:${link.sourceStart}`,
      sourcePath: link.sourcePath,
      target: `${link.target}${link.fragment ? `#${link.fragment}` : ''}`,
      status: link.status as InsightsPresentationStatus,
      broken: true,
      sourceStart: link.sourceStart,
      sourceEnd: link.sourceEnd,
    }));
    for (const document of documents) {
      for (const dynamic of document.dynamicReferences) {
        result.push({
          key: `dynamic:${document.path}:${dynamic.sourceStart}`,
          sourcePath: document.path,
          target: `{${dynamic.expression}}`,
          status: 'dynamic',
          broken: false,
          sourceStart: dynamic.sourceStart,
          sourceEnd: dynamic.sourceEnd,
        });
      }
      for (const reference of document.references) {
        if (!reference.remote) continue;
        const checked = externalResults.get(reference.target);
        result.push({
          key: `remote:${document.path}:${reference.sourceStart}`,
          sourcePath: document.path,
          target: reference.target,
          status: (checked?.status ?? 'unchecked') as InsightsPresentationStatus,
          broken: checked?.status === 'broken' || checked?.status === 'unreachable',
          checkedAt: checked?.checkedAt,
          sourceStart: reference.sourceStart,
          sourceEnd: reference.sourceEnd,
        });
      }
    }
    return result.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.key.localeCompare(b.key));
  }, [documents, externalResults, snapshot.brokenLinks]);

  const brokenCount = rows.filter(row => row.broken).length;
  const checkedCount = externalUrls.filter(url => externalResults.has(url)).length;
  const runCheck = async (recheck = false) => {
    if (!externalCheckingEnabled || !onCheckExternalLinks || !externalUrls.length || isChecking) return;
    setChecking(true);
    try { if (recheck) await onCheckExternalLinks(externalUrls, { recheck: true }); else await onCheckExternalLinks(externalUrls); } finally { setChecking(false); }
  };
  const cancelCheck = () => { onCancelExternalChecks?.(); setChecking(false); };

  return (
    <div className="insights-links">
      <div className="insights-view-summary"><strong data-testid="broken-link-count">{brokenCount}</strong> {format(labels.brokenLinks, { count: brokenCount }).replace(String(brokenCount), '').trim()}{externalUrls.length > 0 ? ` · ${format(labels.uniqueExternalUrls, { count: externalUrls.length })}` : ''}</div>
      {externalUrls.length > 0 && <div className="insights-links__external-actions">{externalCheckingEnabled ? <><button type="button" className="btn btn--sm" disabled={isChecking || !onCheckExternalLinks} onClick={() => void runCheck(false)}>{isChecking ? labels.checkingExternalLinks : labels.checkExternalLinks}</button>{checkedCount > 0 && !isChecking && <button type="button" className="btn btn--sm" disabled={!onCheckExternalLinks} onClick={() => void runCheck(true)}>{labels.recheck}</button>}{isChecking && onCancelExternalChecks && <button type="button" className="btn btn--sm" onClick={cancelCheck}>{labels.cancelChecks}</button>}<span>{format(labels.checkedThisSession, { checked: checkedCount, total: externalUrls.length })}</span></> : <span>{labels.externalDisabled}</span>}</div>}
      {!rows.length && <div className="workspace-insights__empty">{labels.noLinkFindings}</div>}
      <ul className="insights-list">
        {rows.map(row => (
          <li key={row.key} className="insights-list__row insights-links__row">
            <button
              type="button"
              className="insights-lint__target"
              onClick={() => onSelectPath?.(row.sourcePath, { sourceStart: row.sourceStart, sourceEnd: row.sourceEnd })}
              title={`${row.sourcePath} -> ${row.target}`}
              aria-label={`${row.target} - ${row.sourcePath}`}
            >
              <strong>{row.target}</strong>
              <span className="insights-lint__location">{row.sourcePath}</span>
              {row.checkedAt && (
                <span className="insights-lint__message">{new Date(row.checkedAt).toLocaleString()}</span>
              )}
            </button>
            <span className={`insights-status insights-status--${row.status}`} data-status={row.status}>
              {insightsStatusLabel(labels, row.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
