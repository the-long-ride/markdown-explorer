/// <reference lib="webworker" />
import { analyzeDocument, restorePersistedAnalyzedDocument } from './analyzeDocument.ts';
import { normalizeInsightsSettings, type InsightsSettings } from './config.ts';
import { WorkspaceInsightsIndex } from './index.ts';
import type { InsightsWorkerInput, InsightsWorkerOutput } from './workerProtocol.ts';

const index = new WorkspaceInsightsIndex();
let settings: InsightsSettings = normalizeInsightsSettings();
const cancelled = new Set<string>();
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
const send = (message: InsightsWorkerOutput) => ctx.postMessage(message);

async function applyBatch(message: Extract<InsightsWorkerInput, { type: 'applySourceBatch' }>): Promise<void> {
  cancelled.delete(message.jobId);
  const analyzed = [];
  for (let i = 0; i < message.documents.length; i += 1) {
    if (cancelled.has(message.jobId)) { send({ type: 'cancelled', jobId: message.jobId }); return; }
    const source = message.documents[i];
    const document = analyzeDocument({ ...source, lintRules: settings.lintRules });
    index.applyDocument(document);
    analyzed.push(document);
    if (analyzed.length >= 25 || i === message.documents.length - 1) {
      send({ type: 'documentResults', jobId: message.jobId, documents: analyzed.splice(0) });
    }
    if ((i + 1) % 25 === 0 || i === message.documents.length - 1) {
      send({ type: 'progress', jobId: message.jobId, completed: i + 1, total: message.documents.length });
      await Promise.resolve();
    }
  }
  send({ type: 'complete', jobId: message.jobId, snapshot: index.snapshot() });
}

ctx.onmessage = (event: MessageEvent<InsightsWorkerInput>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'initialize': settings = normalizeInsightsSettings(message.settings ?? {}); break;
      case 'updateConfig': settings = normalizeInsightsSettings({ ...settings, ...message.settings }); break;
      case 'restoreCachedDocuments': {
        for (const document of message.documents) index.applyDocument(restorePersistedAnalyzedDocument(document));
        send({ type: 'complete', jobId: message.jobId, snapshot: index.snapshot() });
        break;
      }
      case 'applySourceBatch': void applyBatch(message).catch(error => send({ type: 'error', jobId: message.jobId, message: String(error) })); break;
      case 'applyFsDeltaBatch': {
        for (const delta of message.deltas) {
          if (delta.kind === 'delete') index.removeDocument(delta.relativePath);
          else if (delta.kind === 'rename') index.renameDocument({ fromPath: delta.previousRelativePath, toPath: delta.entry.canonicalRelativePath || delta.entry.relativePath });
        }
        send({ type: 'complete', jobId: message.jobId, snapshot: index.snapshot() });
        break;
      }
      case 'setActiveOverlay': {
        index.applyActiveOverlay(analyzeDocument({ ...message.document, lintRules: settings.lintRules }));
        send({ type: 'complete', jobId: message.jobId, snapshot: index.snapshot() });
        break;
      }
      case 'clearActiveOverlay': index.clearActiveOverlay(message.path); send({ type: 'complete', jobId: message.jobId, snapshot: index.snapshot() }); break;
      case 'requestSnapshot': send({ type: 'complete', jobId: message.jobId, snapshot: index.snapshot() }); break;
      case 'cancel': if (message.jobId) cancelled.add(message.jobId); break;
    }
  } catch (error) {
    send({ type: 'error', ...('jobId' in message && typeof message.jobId === 'string' ? { jobId: message.jobId } : {}), message: String(error instanceof Error ? error.message : error) });
  }
};
