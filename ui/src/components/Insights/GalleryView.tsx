import { useEffect, useMemo, useState } from 'react';
import type { InsightsTranslations } from '../../contexts/insightsTranslations';
import { ensureInsightsUiTranslations, insightsStatusLabel, type InsightsUiTranslations } from '../../contexts/insightsUiTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import type { WorkspaceResourceProbeResult } from '../../insights/contracts';
import type { JumpLocation } from '../../insights/jumpToLocation';
import type { MediaGallery } from '../Modal/mediaGallery';
import { MermaidThumbnail } from './MermaidThumbnail.tsx';

export type GalleryCategory = 'image' | 'diagram' | 'video' | 'audio' | 'document';

interface GalleryItem {
  readonly key: string;
  readonly documentPath: string;
  readonly target: string;
  readonly label: string;
  readonly category: GalleryCategory;
  readonly remote: boolean;
  readonly status?: 'valid' | 'invalid';
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
  readonly diagramCode?: string;
}

export interface GalleryViewProps {
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations | InsightsUiTranslations;
  readonly probeResource?: (documentPath: string, resourcePath: string) => Promise<WorkspaceResourceProbeResult>;
  readonly onSelectPath?: (path: string, location?: JumpLocation) => void;
  readonly onOpenMedia?: (gallery: MediaGallery) => void;
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
        sourceStart: reference.sourceStart,
        sourceEnd: reference.sourceEnd,
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
        sourceStart: diagram.sourceStart,
        sourceEnd: diagram.sourceEnd,
        diagramCode: diagram.code,
      });
    }
  }
  return items;
}

export function GalleryView({ documents, labels: suppliedLabels, probeResource, onSelectPath, onOpenMedia }: GalleryViewProps) {
  const labels = ensureInsightsUiTranslations(suppliedLabels);
  const items = useMemo(() => collectItems(documents), [documents]);
  const [probes, setProbes] = useState<Map<string, WorkspaceResourceProbeResult>>(() => new Map());
  const [loadedRemote, setLoadedRemote] = useState<Set<string>>(() => new Set());
  const [activeCategory, setActiveCategory] = useState<'all' | GalleryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenMedia = (item: GalleryItem, svgHtml?: string) => {
    const media: MediaGallery = {
      items: [{
        type: item.category === 'diagram' ? 'svg' : 'img',
        src: item.category === 'diagram' ? undefined : item.target,
        source: item.diagramCode,
        html: svgHtml,
        kind: item.label,
      }],
      currentIndex: 0,
    };
    if (onOpenMedia) {
      onOpenMedia(media);
    } else {
      window.dispatchEvent(new CustomEvent('markdown-explorer-open-media-modal', {
        detail: media,
      }));
    }
  };

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

  const counts = useMemo(() => {
    const res: Record<string, number> = { all: items.length, image: 0, diagram: 0, video: 0, audio: 0, document: 0 };
    for (const item of items) res[item.category] = (res[item.category] || 0) + 1;
    return res;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (q) {
        const matchLabel = item.label.toLowerCase().includes(q);
        const matchTarget = item.target.toLowerCase().includes(q);
        const matchDoc = item.documentPath.toLowerCase().includes(q);
        if (!matchLabel && !matchTarget && !matchDoc) return false;
      }
      return true;
    });
  }, [items, activeCategory, searchQuery]);

  if (!items.length) return <div className="workspace-insights__empty">{labels.noMedia}</div>;

  return (
    <div className="insights-gallery-shell">
      <div className="insights-gallery__toolbar">
        <div className="insights-gallery__filters" role="tablist" aria-label={labels.gallery}>
          <button
            type="button"
            data-category="all"
            className={`insights-filter-chip${activeCategory === 'all' ? ' is-active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            {labels.all} ({counts.all})
          </button>
          {(['image', 'diagram', 'document', 'video', 'audio'] as const).map(cat => {
            const count = counts[cat] || 0;
            if (count === 0 && activeCategory !== cat) return null;
            return (
              <button
                key={cat}
                type="button"
                data-category={cat}
                className={`insights-filter-chip${activeCategory === cat ? ' is-active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {labels.presentation.galleryCategories[cat]} ({count})
              </button>
            );
          })}
        </div>
        <input
          type="search"
          className="insights-gallery__search"
          placeholder="Filter media or diagrams..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Filter media or diagrams"
        />
      </div>

      {!filteredItems.length ? (
        <div className="workspace-insights__empty">No items match your filter.</div>
      ) : (
        <div className="insights-gallery" aria-label={labels.gallery}>
          {filteredItems.map(item => {
            const loaded = loadedRemote.has(item.key);
            const probe = probes.get(item.key);
            const category = labels.presentation.galleryCategories[item.category];
            const status = item.status ? insightsStatusLabel(labels, item.status) : '';
            const docBasename = item.documentPath.split('/').pop() || item.documentPath;
            return (
              <article
                className="insights-card"
                key={item.key}
                data-testid={`gallery-card-${item.key}`}
                data-category={item.category}
                onClick={() => onSelectPath?.(item.documentPath, { sourceStart: item.sourceStart, sourceEnd: item.sourceEnd })}
                tabIndex={0}
                role="button"
                onKeyDown={e => { if (e.key === 'Enter') onSelectPath?.(item.documentPath, { sourceStart: item.sourceStart, sourceEnd: item.sourceEnd }); }}
              >
                {item.category === 'diagram' ? (
                  <MermaidThumbnail
                    code={item.diagramCode}
                    label={item.label}
                    status={item.status}
                    onOpenMedia={(svgHtml) => handleOpenMedia(item, svgHtml)}
                  />
                ) : item.category === 'image' && item.remote && loaded ? (
                  <img
                    src={item.target}
                    alt={item.label}
                    loading="lazy"
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenMedia(item);
                    }}
                  />
                ) : item.category === 'image' ? (
                  <div className="insights-card__thumb">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                ) : item.category === 'video' && item.remote && loaded ? (
                  <video src={item.target} controls preload="none" aria-label={item.label} />
                ) : item.category === 'audio' && item.remote && loaded ? (
                  <audio src={item.target} controls preload="none" aria-label={item.label} />
                ) : (
                  <div className="insights-card__thumb">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <div className="insights-card__meta">
                  <span>{item.category === 'diagram' ? `${category} · ${status}` : category}</span>
                  {!item.remote && item.category !== 'diagram' && <span>{probe ? insightsStatusLabel(labels, probe.status) : '…'}</span>}
                  {item.remote && <span>{labels.remoteMedia}</span>}
                </div>
                <div className="insights-card__title" title={item.label}>{item.label}</div>
                <div className="insights-card__target" title={item.target}>{item.target}</div>
                <div className="insights-card__doc" title={item.documentPath}>
                  <span>{docBasename}</span>
                </div>
                {item.category === 'image' && (!loaded || !item.remote) && (
                  <div className="insights-card__actions" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn--sm"
                      aria-label={`${labels.loadPreview}: ${item.label}`}
                      onClick={e => {
                        e.stopPropagation();
                        if (item.remote) setLoadedRemote(current => new Set(current).add(item.key));
                        handleOpenMedia(item);
                      }}
                    >
                      {labels.loadPreview}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
