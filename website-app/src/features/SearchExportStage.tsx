// =============================================================================
// website-app/src/features/SearchExportStage.tsx
// Dedicated stages for Search & Bookmarks and Batch Export & Scope View.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBookmarkWorkspaceKey } from '../../../ui/src/bookmarks/bookmarkModel';
import { bookmarkStore } from '../../../ui/src/bookmarks/bookmarkStore';
import type { BookmarkRecord, OpenBookmarkWorkspace } from '../../../ui/src/bookmarks/types';
import { BookmarksPanel } from '../../../ui/src/components/Bookmarks/BookmarksPanel';
import { Content } from '../../../ui/src/components/Content/Content';
import { ExportCenterModal } from '../../../ui/src/components/Export/ExportCenterModal';
import { MediaModal } from '../../../ui/src/components/Modal/MediaModal';
import { ScopeViewModal } from '../../../ui/src/components/Modal/ScopeViewModal';
import { createMediaGallery, type MediaGallery } from '../../../ui/src/components/Modal/mediaGallery';
import { SearchOverlay } from '../../../ui/src/components/Search/SearchOverlay';
import { useAppState } from '../../../ui/src/contexts/AppStateContext';
import { getTranslations } from '../../../ui/src/contexts/translations';
import type { MdFile, WorkspaceSearchResult } from '../../../ui/src/types';
import {
  DEMO_FILES,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_PATH,
} from './demoMarkdownFixtures';

export interface SearchExportStageProps {
  readonly mode?: 'search-bookmarks' | 'export-center';
  readonly onSelectDoc?: (path: string) => void;
}

function buildSeedBookmark(
  id: string,
  name: string,
  filePath: string,
  selectedText: string,
  workspaceKey: string,
): BookmarkRecord {
  const now = 1730000000000;
  return {
    id,
    name,
    workspaceKey,
    workspaceName: DEMO_WORKSPACE_NAME,
    workspacePath: DEMO_WORKSPACE_PATH,
    filePath,
    targetKind: 'text',
    sourceAnchor: {
      start: 0,
      end: selectedText.length,
      fragment: selectedText,
      fingerprint: `demo-${id}`,
      occurrence: 0,
      prefix: '',
      suffix: '',
    },
    renderedText: selectedText,
    selectedText,
    matchOrdinal: 0,
    matchIndex: 0,
    prefix: '',
    suffix: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function SearchExportStage({
  mode = 'search-bookmarks',
  onSelectDoc,
}: SearchExportStageProps) {
  const { state, navigate } = useAppState();
  const t = getTranslations(state.settings.language || 'en');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(mode === 'export-center');
  const [scopeFile, setScopeFile] = useState<MdFile | null>(null);
  const [mediaGallery, setMediaGallery] = useState<MediaGallery | null>(null);

  useEffect(() => {
    setExportOpen(mode === 'export-center');
    setSearchOpen(false);
    setScopeFile(null);
  }, [mode]);

  const workspaceKey = getBookmarkWorkspaceKey(
    state.workspacePath ?? DEMO_WORKSPACE_PATH,
    state.workspaceName || DEMO_WORKSPACE_NAME,
  );

  useEffect(() => {
    const existing = bookmarkStore
      .getSnapshot()
      .items.filter((item) => item.workspaceKey === workspaceKey);
    if (existing.length > 0) return;
    const seeds: BookmarkRecord[] = [
      buildSeedBookmark(
        'demo-bm-arch',
        'Runtime Pipeline Diagram',
        'docs/architecture-overview.md',
        'Markdown Explorer renders local documentation folders into an interactive, zero-telemetry workspace.',
        workspaceKey,
      ),
      buildSeedBookmark(
        'demo-bm-metrics',
        'Engine Cold-Start Benchmarks',
        'docs/metrics-benchmarks.md',
        'Rust Tauri: 180 ms cold start, 42 MB idle RAM, 14 ms search over 1k docs.',
        workspaceKey,
      ),
      buildSeedBookmark(
        'demo-bm-release',
        'Release Verification Gate',
        'docs/release-playbook.md',
        'Verify source line-count limits, strict TypeScript typechecking, and offline diagram rendering.',
        workspaceKey,
      ),
    ];
    for (const seed of seeds) {
      bookmarkStore.add(seed);
    }
  }, [workspaceKey]);

  const workspaces = useMemo<OpenBookmarkWorkspace[]>(
    () => [
      {
        id: 'demo-workspace',
        workspaceKey,
        workspaceName: state.workspaceName || DEMO_WORKSPACE_NAME,
        workspacePath: state.workspacePath ?? DEMO_WORKSPACE_PATH,
      },
    ],
    [state.workspaceName, state.workspacePath, workspaceKey],
  );

  const openDocument = useCallback(
    (path: string) => {
      navigate(path);
      onSelectDoc?.(path);
    },
    [navigate, onSelectDoc],
  );

  const handleBookmarkNavigate = (bookmark: BookmarkRecord) => {
    openDocument(bookmark.filePath);
  };

  const handleWorkspaceSearchSelect = (item: WorkspaceSearchResult, _query: string) => {
    openDocument(item.fsPath);
    setSearchOpen(false);
  };

  const handleImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) setMediaGallery(gallery);
  }, []);

  if (mode === 'export-center') {
    const defaultScopeFile =
      DEMO_FILES.find((file) => file.fsPath === state.currentFile) ?? DEMO_FILES[0] ?? null;

    return (
      <div className="demo-search-export-stage" data-testid="demo-export-center-stage">
        <div className="demo-stage-bar demo-stage-bar--wrap">
          <div className="demo-stage-bar__actions">
            <button
              type="button"
              className="btn btn--primary demo-action-btn"
              onClick={() => setExportOpen(true)}
            >
              Export Center
            </button>
            <button
              type="button"
              className="btn demo-action-btn"
              onClick={() => defaultScopeFile && setScopeFile(defaultScopeFile)}
            >
              Scope View
            </button>
          </div>
          <div className="demo-doc-pills">
            {DEMO_FILES.map((file) => (
              <button
                key={file.fsPath}
                type="button"
                className="demo-pill-btn"
                onClick={() => setScopeFile(file)}
              >
                {file.fileName}
              </button>
            ))}
          </div>
        </div>

        <div className="demo-stage-content-host">
          <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
        </div>

        <ExportCenterModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
        <ScopeViewModal
          initialFile={scopeFile}
          files={DEMO_FILES}
          onClose={() => setScopeFile(null)}
          onMediaClick={handleImageClick}
        />
        <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
      </div>
    );
  }

  return (
    <div className="demo-search-export-stage" data-testid="demo-search-bookmarks-stage">
      <div className="demo-stage-bar">
        <span className="demo-stage-bar__label">{state.relativePath || 'docs/architecture-overview.md'}</span>
        <div className="demo-stage-bar__actions">
          <button
            type="button"
            className="btn btn--primary demo-action-btn"
            onClick={() => setSearchOpen(true)}
          >
            Search
          </button>
        </div>
      </div>

      <div className="demo-search-export-grid">
        <section className="demo-capability-card">
          <div className="demo-bookmarks-host">
            <BookmarksPanel
              visible={true}
              viewMode="focus"
              workspaces={workspaces}
              activeWorkspaceKey={workspaceKey}
              translations={t.bookmarks}
              onNavigate={handleBookmarkNavigate}
            />
          </div>
        </section>

        <section className="demo-capability-card">
          <div className="demo-preview-host">
            <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
          </div>
        </section>
      </div>

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        scopeKey="demo"
        onWorkspaceSelect={handleWorkspaceSearchSelect}
      />
      <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
    </div>
  );
}
