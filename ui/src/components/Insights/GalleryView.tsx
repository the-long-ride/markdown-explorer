import { useEffect, useMemo, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import type { WorkspaceResourceProbeResult } from '../../insights/contracts';

export type GalleryCategory = 'image' | 'diagram' | 'video' | 'audio' | 'document';

interface GalleryItem {
  readonly key: string;
  readonly documentPath: string;
  readonly target: string;
  readonly label: string;
  readonly category: GalleryCategory;
  readonly remote: boolean;
  readonly status?: 'valid' | 'invalid';
}

export interface GalleryViewProps {
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations;
  readonly probeResource?: (documentPath: string, resourcePath: string) => Promise<WorkspaceResourceProbeResult>;
}

const IMAGE = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const VIDEO = /\.(?:mp4|webm|mov|m4v|ogv)$/i;
const AUDIO = /\.(?:mp3|wav|ogg|m4a|aac|flac|opus)$/i;
const DOCUMENT = /\.(?:pdf|docx?|xlsx?|pptx?|html?|rtf)$/i;

function categoryFor(target: string): GalleryCategory | null {
  const path = target.split(/[?#]/, 1)[0];
  if (IMAGE.test(path)) return 'image';
  if (VIDEO.test(path)) return 'video';
  if (AUDIO.test(path)) return 'audio';
  if (DOCUMENT.test(path)) return 'document';
  return null;
}

function collectItems(documents: readonly AnalyzedDocument[]): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const document of documents) {
    for (const reference of document.references) {
      const category = categoryFor(reference.target);
      if (!category) continue;
      items.push({
        key: `${document.path}:${reference.sourceStart}:${reference.target}`,
        documentPath: document.path,
        target: reference.target,
        label: reference.label || reference.target.split('/').pop() || reference.target,
        category,
        remote: reference.remote,
      });
    }
    for (const diagram of document.diagrams) {
      items.push({
        key: `${document.path}:mermaid:${diagram.sourceStart}`,
        documentPath: document.path,
        target: `Mermaid · ${diagram.sourceStart}`,
        label: `${document.path} · Mermaid`,
        category: 'diagram',
        remote: false,
        status: diagram.status,
      });
    }
  }
  return items;
}

export function GalleryView({ documents, labels = INSIGHTS_TRANSLATIONS.en, probeResource }: GalleryViewProps) {
  const items = useMemo(() => collectItems(documents), [documents]);
  const [probes, setProbes] = useState<Map<string, WorkspaceResourceProbeResult>>(() => new Map());
  const [loadedRemote, setLoadedRemote] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!probeResource) return;
    let cancelled = false;
    for (const item of items) {
      if (item.remote || item.category === 'diagram') continue;
      void probeResource(item.documentPath, item.target).then(result => {
        if (cancelled) return;
        setProbes(current => new Map(current).set(item.key, result));
      });
    }
    return () => { cancelled = true; };
  }, [items, probeResource]);

  if (!items.length) return <div className="workspace-insights__empty">{labels.noMedia}</div>;

  return (
    <div className="insights-gallery" aria-label={labels.gallery}>
      {items.map(item => {
        const loaded = loadedRemote.has(item.key);
        const probe = probes.get(item.key);
        return (
          <article className="insights-card" key={item.key}>
            <div className="insights-card__meta">
              <span>{item.category === 'diagram' ? `${item.category} · ${item.status ?? ''}` : item.category}</span>
              {!item.remote && item.category !== 'diagram' && <span>{probe?.status ?? '…'}</span>}
              {item.remote && <span>{labels.remoteMedia}</span>}
            </div>
            <div className="insights-card__title">{item.label}</div>
            <div className="insights-card__target">{item.target}</div>
            {item.remote && !loaded && (
              <button
                type="button"
                className="btn btn--sm"
                aria-label={`${labels.loadPreview}: ${item.label}`}
                onClick={() => setLoadedRemote(current => new Set(current).add(item.key))}
              >
                {labels.loadPreview}
              </button>
            )}
            {item.remote && loaded && item.category === 'image' && <img src={item.target} alt={item.label} loading="lazy" />}
            {item.remote && loaded && item.category === 'video' && <video src={item.target} controls preload="metadata" aria-label={item.label} />}
            {item.remote && loaded && item.category === 'audio' && <audio src={item.target} controls preload="metadata" aria-label={item.label} />}
          </article>
        );
      })}
    </div>
  );
}
