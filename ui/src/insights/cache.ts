import { INSIGHTS_CACHE_DB_NAME } from '../constants/storage.ts';
import type { PersistedAnalyzedDocument } from './analyzeDocument.ts';

export const INSIGHTS_CACHE_SCHEMA_VERSION = 2;
export const INSIGHTS_ANALYZER_COMPONENT_VERSION = 1;

export type InsightsCacheLintRules = Readonly<Record<string, {
  readonly enabled: boolean;
  readonly severity: string;
}>>;

export function createInsightsCacheAnalysisSignature(
  lintRules: InsightsCacheLintRules,
  analyzerVersion = INSIGHTS_ANALYZER_COMPONENT_VERSION,
): string {
  const canonicalRules = Object.entries(lintRules)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ruleId, rule]) => [ruleId, { enabled: Boolean(rule.enabled), severity: String(rule.severity) }]);
  return `analysis-v${analyzerVersion}:${JSON.stringify(canonicalRules)}`;
}

export const DEFAULT_INSIGHTS_CACHE_ANALYSIS_SIGNATURE = createInsightsCacheAnalysisSignature({});

export interface InsightsCachedDocument {
  readonly path: string;
  readonly sizeBytes: number;
  readonly mtimeMs: number;
  readonly contentHash?: string;
  readonly persisted: PersistedAnalyzedDocument;
  readonly lastAccessedAt?: number;
}

export interface InsightsWorkspaceCacheInput {
  readonly workspaceId: string;
  readonly analyzerVersion?: number;
  readonly analysisSignature?: string;
  readonly updatedAt?: number;
  readonly documents: readonly InsightsCachedDocument[];
  readonly source?: unknown;
  readonly externalSession?: unknown;
  readonly privateApprovals?: unknown;
}

export interface InsightsWorkspaceCache {
  readonly workspaceId: string;
  readonly schemaVersion: number;
  readonly analyzerVersion: number;
  readonly analysisSignature?: string;
  readonly updatedAt: number;
  readonly documents: readonly InsightsCachedDocument[];
}

export interface InsightsCacheStoreOptions {
  readonly indexedDB?: IDBFactory;
  readonly dbName?: string;
  readonly capBytes?: number;
  readonly now?: () => number;
}

const DEFAULT_CAP = 500 * 1024 * 1024;
const STORE = 'workspaces';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}

function sanitizePersistedDocument(raw: PersistedAnalyzedDocument): PersistedAnalyzedDocument {
  const value = raw as any;
  return {
    path: String(value.path ?? ''),
    revision: String(value.revision ?? ''),
    title: String(value.title ?? ''),
    aliases: Array.isArray(value.aliases) ? value.aliases.map(String) : [],
    tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
    anchors: Array.isArray(value.anchors) ? value.anchors.map(String) : [],
    headings: Array.isArray(value.headings) ? value.headings.map((heading: any) => ({
      text: String(heading?.text ?? ''),
      level: Number(heading?.level) || 0,
      sourceStart: Number(heading?.sourceStart) || 0,
      sourceEnd: Number(heading?.sourceEnd) || 0,
    })) : [],
    references: Array.isArray(value.references) ? value.references.map((reference: any) => ({ ...reference })) : [],
    dynamicReferences: Array.isArray(value.dynamicReferences) ? value.dynamicReferences.map((reference: any) => ({ ...reference })) : [],
    sections: Array.isArray(value.sections) ? value.sections.map((section: any) => ({
      heading: String(section?.heading ?? ''),
      level: Number(section?.level) || 0,
      sourceStart: Number(section?.sourceStart) || 0,
      sourceEnd: Number(section?.sourceEnd) || 0,
      fingerprint: String(section?.fingerprint ?? ''),
    })) : [],
    diagrams: Array.isArray(value.diagrams) ? value.diagrams.map((diagram: any) => ({
      kind: 'mermaid' as const,
      status: diagram?.status === 'invalid' ? 'invalid' as const : 'valid' as const,
      sourceStart: Number(diagram?.sourceStart) || 0,
      sourceEnd: Number(diagram?.sourceEnd) || 0,
      fingerprint: String(diagram?.fingerprint ?? ''),
      code: diagram?.code ? String(diagram.code) : undefined,
    })) : [],
    exactFingerprint: String(value.exactFingerprint ?? ''),
    terminologySignatures: Array.isArray(value.terminologySignatures) ? value.terminologySignatures.map(String) : [],
    lint: Array.isArray(value.lint) ? value.lint.map((finding: any) => ({ ...finding })) : [],
  } as PersistedAnalyzedDocument;
}

function sanitizeDocument(raw: InsightsCachedDocument): InsightsCachedDocument {
  return {
    path: String(raw.path),
    sizeBytes: Math.max(0, Number(raw.sizeBytes) || 0),
    mtimeMs: Math.max(0, Number(raw.mtimeMs) || 0),
    ...(raw.contentHash ? { contentHash: String(raw.contentHash) } : {}),
    persisted: sanitizePersistedDocument(raw.persisted),
    ...(raw.lastAccessedAt !== undefined ? { lastAccessedAt: Number(raw.lastAccessedAt) || 0 } : {}),
  };
}

function estimateBytes(value: unknown): number { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }

export class InsightsCacheStore {
  readonly capBytes: number;
  private readonly factory: IDBFactory;
  private readonly dbName: string;
  private readonly now: () => number;
  private dbPromise?: Promise<IDBDatabase>;

  constructor(options: InsightsCacheStoreOptions = {}) {
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) throw new Error('IndexedDB is unavailable');
    this.factory = factory; this.dbName = options.dbName ?? INSIGHTS_CACHE_DB_NAME;
    this.capBytes = Math.max(1, options.capBytes ?? DEFAULT_CAP); this.now = options.now ?? Date.now;
  }

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = this.factory.open(this.dbName, INSIGHTS_CACHE_SCHEMA_VERSION);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'workspaceId' }); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async putWorkspace(input: InsightsWorkspaceCacheInput): Promise<void> {
    const record: InsightsWorkspaceCache = {
      workspaceId: String(input.workspaceId),
      schemaVersion: INSIGHTS_CACHE_SCHEMA_VERSION,
      analyzerVersion: input.analyzerVersion ?? INSIGHTS_ANALYZER_COMPONENT_VERSION,
      analysisSignature: input.analysisSignature ?? DEFAULT_INSIGHTS_CACHE_ANALYSIS_SIGNATURE,
      updatedAt: input.updatedAt ?? this.now(),
      documents: input.documents.map(sanitizeDocument),
    };
    const db = await this.open(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(record); await txDone(tx);
    await this.evictIfNeeded(record.workspaceId);
  }

  async getWorkspace(
    workspaceId: string,
    analyzerVersion = INSIGHTS_ANALYZER_COMPONENT_VERSION,
    analysisSignature = DEFAULT_INSIGHTS_CACHE_ANALYSIS_SIGNATURE,
  ): Promise<InsightsWorkspaceCache | undefined> {
    const db = await this.open(); const tx = db.transaction(STORE, 'readonly');
    const result = await request(tx.objectStore(STORE).get(workspaceId)) as InsightsWorkspaceCache | undefined; await txDone(tx);
    if (!result) return undefined;
    if (result.schemaVersion !== INSIGHTS_CACHE_SCHEMA_VERSION
      || result.analyzerVersion !== analyzerVersion
      || result.analysisSignature !== analysisSignature) {
      await this.deleteWorkspace(workspaceId);
      return undefined;
    }
    return result;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> { const db = await this.open(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(workspaceId); await txDone(tx); }
  async clear(): Promise<void> { const db = await this.open(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); await txDone(tx); }

  private async evictIfNeeded(activeWorkspaceId: string): Promise<void> {
    const db = await this.open(); const tx = db.transaction(STORE, 'readonly');
    const all = await request(tx.objectStore(STORE).getAll()) as InsightsWorkspaceCache[]; await txDone(tx);
    let total = all.reduce((sum, item) => sum + estimateBytes(item), 0); if (total <= this.capBytes) return;
    const candidates = all.filter(item => item.workspaceId !== activeWorkspaceId).sort((a, b) => a.updatedAt - b.updatedAt);
    for (const item of candidates) { if (total <= this.capBytes) break; total -= estimateBytes(item); await this.deleteWorkspace(item.workspaceId); }
    if (total <= this.capBytes) return;
    const active = all.find(item => item.workspaceId === activeWorkspaceId); if (!active) return;
    const docs = [...active.documents].sort((a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0));
    while (docs.length && estimateBytes({ ...active, documents: docs }) > this.capBytes) docs.shift();
    if (docs.length !== active.documents.length) await this.putWorkspace({ ...active, documents: docs });
  }

  async close(): Promise<void> { const db = await this.dbPromise; db?.close(); this.dbPromise = undefined; }
}
