import { useMemo, useState } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import type { GitRevisionSummary } from '../../history/contracts';
import type { HistoryClient } from '../../history/historyClient';

interface DocumentHistoryPanelProps {
  filePath: string;
  client: HistoryClient;
  language?: string;
  onClose: () => void;
  onViewRevision: (revision: GitRevisionSummary) => void | Promise<void>;
  onCompareCurrent?: (revision: GitRevisionSummary) => void | Promise<void>;
  onCompareWorkingCopy?: (revision: GitRevisionSummary) => void | Promise<void>;
  onCompareSelected?: (left: GitRevisionSummary, right: GitRevisionSummary) => void | Promise<void>;
}

export function DocumentHistoryPanel({
  filePath,
  client,
  language,
  onClose,
  onViewRevision,
  onCompareCurrent,
  onCompareWorkingCopy,
  onCompareSelected,
}: DocumentHistoryPanelProps) {
  const t = getHistoryTranslations(language);
  const [revisions, setRevisions] = useState<readonly GitRevisionSummary[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const selectedRevisions = useMemo(
    () => selected.map((oid) => revisions.find((revision) => revision.oid === oid)).filter((revision): revision is GitRevisionSummary => Boolean(revision)),
    [revisions, selected],
  );

  const capabilityMessage = (reason?: string) => {
    if (reason === 'unsupported-runtime') return t.unsupportedRuntime;
    if (reason === 'git-unavailable') return t.gitUnavailable;
    if (reason === 'not-repository') return t.notRepository;
    return t.historyUnavailable;
  };
  const load = async () => {
    setStatus('loading'); setMessage(''); setActionMessage('');
    try {
      const capability = await client.getCapability();
      if (!capability.supported) { setStatus('error'); setMessage(capabilityMessage(capability.reason)); return; }
      setRevisions(await client.listDocumentHistory(filePath)); setStatus('ready');
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const runAction = async (action: () => void | Promise<void>) => {
    setActionMessage('');
    try {
      await action();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setActionMessage(detail || t.historyUnavailable);
    }
  };
  const toggleSelected = (oid: string) => setSelected((current) => current.includes(oid)
    ? current.filter((item) => item !== oid)
    : current.length >= 2 ? [current[1], oid] : [...current, oid]);

  return (
    <div className="history-panel-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="document-history-panel" role="dialog" aria-modal="true" aria-label={t.documentHistory}>
        <header className="document-history-panel__header">
          <div><h2>{t.history}</h2><div className="document-history-panel__path" title={filePath}>{filePath}</div></div>
          <button type="button" className="btn" onClick={onClose} aria-label={t.closeHistory}>{t.closeHistory}</button>
        </header>
        {status === 'idle' && <button type="button" className="btn document-history-panel__load" onClick={() => { void load(); }}>{t.loadHistory}</button>}
        {status === 'loading' && <div role="status">{t.loadingHistory}</div>}
        {status === 'error' && <div className="document-history-panel__error" role="status"><p>{message}</p><button type="button" className="btn" onClick={() => { void load(); }}>{t.retry}</button></div>}
        {status === 'ready' && actionMessage && <div className="document-history-panel__error" role="status">{actionMessage}</div>}
        {status === 'ready' && revisions.length === 0 && <div role="status">{t.noHistory}</div>}
        {status === 'ready' && revisions.length > 0 && (
          <>
            {onCompareSelected && <div className="document-history-panel__selection-actions"><button type="button" className="btn" disabled={selectedRevisions.length !== 2} onClick={() => { if (selectedRevisions.length === 2) void runAction(() => onCompareSelected(selectedRevisions[0], selectedRevisions[1])); }}>{t.compareSelected}</button></div>}
            <ol className="document-history-panel__list">
              {revisions.map((revision) => (
                <li key={revision.oid} className="document-history-panel__revision">
                  <div className="document-history-panel__revision-main">
                    {onCompareSelected && <input type="checkbox" aria-label={`${t.revision} ${revision.shortOid}`} checked={selected.includes(revision.oid)} onChange={() => toggleSelected(revision.oid)} />}
                    <div>
                      <div className="document-history-panel__subject">{revision.subject || t.noCommitMessage}</div>
                      <div className="document-history-panel__meta"><code>{revision.shortOid}</code><span>{revision.author}</span><time dateTime={revision.authoredAt}>{new Date(revision.authoredAt).toLocaleString(language)}</time></div>
                      <div className="document-history-panel__revision-path">{revision.path}</div>
                    </div>
                  </div>
                  <div className="document-history-panel__actions">
                    <button type="button" className="btn" onClick={() => { void runAction(() => onViewRevision(revision)); }}>{t.viewRevision}</button>
                    {onCompareCurrent && <button type="button" className="btn" onClick={() => { void runAction(() => onCompareCurrent(revision)); }}>{t.compareCurrent}</button>}
                    {onCompareWorkingCopy && <button type="button" className="btn" onClick={() => { void runAction(() => onCompareWorkingCopy(revision)); }}>{t.workingCopy}</button>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}
