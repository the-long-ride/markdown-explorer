import { useMemo, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import type { ExternalLinkCheckResult } from '../../insights/contracts';
import type { WorkspaceInsightsSnapshot } from '../../insights/index';

export interface LinksViewProps {
  readonly snapshot: WorkspaceInsightsSnapshot;
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations;
  readonly externalResults: ReadonlyMap<string, ExternalLinkCheckResult>;
  readonly externalCheckingEnabled?: boolean;
  readonly externalChecking?: boolean;
  readonly onCheckExternalLinks?: (urls: readonly string[], options?: { readonly recheck?: boolean }) => Promise<readonly ExternalLinkCheckResult[] | void>;
  readonly onCancelExternalChecks?: () => void;
}

interface LinkRow {
  readonly key: string;
  readonly sourcePath: string;
  readonly target: string;
  readonly status: string;
  readonly broken: boolean;
  readonly checkedAt?: string;
}

function format(value: string, replacements: Readonly<Record<string, string | number>>): string {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)),
    value,
  );
}

export function LinksView({
  snapshot,
  documents,
  labels = INSIGHTS_TRANSLATIONS.en,
  externalResults,
  externalCheckingEnabled = false,
  externalChecking = false,
  onCheckExternalLinks,
  onCancelExternalChecks,
}: LinksViewProps) {
  const externalUrls = useMemo(() => [...new Set(documents.flatMap(document =>
    document.references.filter(reference => reference.remote).map(reference => reference.target),
  ))].sort(), [documents]);
  const [checking, setChecking] = useState(false);
  const isChecking = externalChecking || checking;

  const rows = useMemo<LinkRow[]>(() => {
    const result: LinkRow[] = snapshot.brokenLinks.map(link => ({
      key: `broken:${link.sourcePath}:${link.sourceStart}`,
      sourcePath: link.sourcePath,
      target: `${link.target}${link.fragment ? `#${link.fragment}` : ''}`,
      status: link.status,
      broken: true,
    }));
    for (const document of documents) {
      for (const dynamic of document.dynamicReferences) {
        result.push({
          key: `dynamic:${document.path}:${dynamic.sourceStart}`,
          sourcePath: document.path,
          target: `{${dynamic.expression}}`,
          status: 'dynamic',
          broken: false,
        });
      }
      for (const reference of document.references) {
        if (!reference.remote) continue;
        const checked = externalResults.get(reference.target);
        result.push({
          key: `remote:${document.path}:${reference.sourceStart}`,
          sourcePath: document.path,
          target: reference.target,
          status: checked?.status ?? 'unchecked',
          broken: checked?.status === 'broken' || checked?.status === 'unreachable',
          checkedAt: checked?.checkedAt,
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
    try {
      if (recheck) await onCheckExternalLinks(externalUrls, { recheck: true });
      else await onCheckExternalLinks(externalUrls);
    } finally {
      setChecking(false);
    }
  };

  const cancelCheck = () => {
    onCancelExternalChecks?.();
    setChecking(false);
  };

  return (
    <div className="insights-links">
      <div className="insights-view-summary">
        <strong data-testid="broken-link-count">{brokenCount}</strong> {format(labels.brokenLinks, { count: brokenCount }).replace(String(brokenCount), '').trim()}
        {externalUrls.length > 0 ? ` · ${format(labels.uniqueExternalUrls, { count: externalUrls.length })}` : ''}
      </div>

      {externalUrls.length > 0 && (
        <div className="insights-links__external-actions">
          {externalCheckingEnabled ? (
            <>
              <button type="button" className="btn btn--sm" disabled={isChecking || !onCheckExternalLinks} onClick={() => void runCheck(false)}>
                {isChecking ? labels.checkingExternalLinks : labels.checkExternalLinks}
              </button>
              {checkedCount > 0 && !isChecking && (
                <button type="button" className="btn btn--sm" disabled={!onCheckExternalLinks} onClick={() => void runCheck(true)}>{labels.recheck}</button>
              )}
              {isChecking && onCancelExternalChecks && <button type="button" className="btn btn--sm" onClick={cancelCheck}>{labels.cancelChecks}</button>}
              <span>{format(labels.checkedThisSession, { checked: checkedCount, total: externalUrls.length })}</span>
            </>
          ) : (
            <span>{labels.externalDisabled}</span>
          )}
        </div>
      )}

      {!rows.length && <div className="workspace-insights__empty">{labels.noLinkFindings}</div>}
      <ul className="insights-list">
        {rows.map(row => (
          <li key={row.key} className="insights-list__row">
            <div>
              <strong>{row.target}</strong>
              <span>{row.sourcePath}{row.checkedAt ? ` · ${new Date(row.checkedAt).toLocaleString()}` : ''}</span>
            </div>
            <span className={`insights-status insights-status--${row.status}`} data-status={row.status}>{row.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
