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
  const [lastAction, setLastAction] = useState<string>(
    mode === 'export-center'
      ? 'Configure batch HTML/PDF/ZIP export or inspect docs in ScopeViewModal.'
      : 'Click any bookmark or open SearchOverlay to jump inside the live preview.',
  );

  useEffect(() => {
    setExportOpen(mode === 'export-center');
    setSearchOpen(false);
    setScopeFile(null);
    setLastAction(
      mode === 'export-center'
        ? 'Configure batch HTML/PDF/ZIP export or inspect docs in ScopeViewModal.'
        : 'Click any bookmark or open SearchOverlay to jump inside the live preview.',
    );
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
    setLastAction(`Navigated to bookmark "${bookmark.name}" (${bookmark.filePath})`);
  };

  const handleWorkspaceSearchSelect = (item: WorkspaceSearchResult, query: string) => {
    openDocument(item.fsPath);
    setSearchOpen(false);
    setLastAction(
      `Opened search match "${query}" in ${item.relativePath}:${item.lineNumber ?? 1}`,
    );
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
        <div className="demo-stage-bar">
          <span className="demo-stage-bar__label">{lastAction}</span>
          <div className="demo-stage-bar__actions">
            <button
              type="button"
              className="btn btn--primary demo-action-btn"
              onClick={() => setExportOpen(true)}
            >
              Open Export Center
            </button>
            <button
              type="button"
              className="btn demo-action-btn"
              onClick={() => defaultScopeFile && setScopeFile(defaultScopeFile)}
            >
              Open Scope View
            </button>
          </div>
        </div>

        <div className="demo-search-export-grid">
          <section className="demo-capability-card">
            <header className="demo-capability-card__head">
              <div>
                <span className="demo-capability-card__eyebrow">Batch Export &amp; Scope</span>
                <h3 className="demo-capability-card__title">Export Center &amp; Multi-Doc Reader</h3>
              </div>
              <span className="demo-capability-card__pill">{DEMO_FILES.length} Demo Docs</span>
            </header>
            <div className="demo-capability-card__body">
              <p className="demo-capability-card__copy">
                Bundle current files, selected subsets, folders, or the entire workspace into
                standalone HTML or static ZIP archives via <strong>ExportCenterModal</strong>, or
                traverse linked documents inside <strong>ScopeViewModal</strong>.
              </p>
              <div className="demo-launcher-stack">
                <div className="demo-launcher-box">
                  <div className="demo-launcher-box__title">Export Center Studio</div>
                  <div className="demo-launcher-box__desc">
                    Supports Current File, Selected Files, Folder, and Whole Workspace modes with
                    live progress rows.
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setExportOpen(true)}
                  >
                    Launch Export Center Modal
                  </button>
                </div>
                <div className="demo-launcher-box">
                  <div className="demo-launcher-box__title">Scope View Modal</div>
                  <div className="demo-launcher-box__desc">
                    Open any workspace document in an isolated reader overlay with scoped TOC and
                    cross-document link history.
                  </div>
                  <div className="demo-doc-pills">
                    {DEMO_FILES.map((file) => (
                      <button
                        key={file.fsPath}
                        type="button"
                        className="demo-pill-btn"
                        onClick={() => {
                          setScopeFile(file);
                          setLastAction(`Opened ${file.relativePath} in ScopeViewModal.`);
                        }}
                      >
                        {file.fileName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="demo-capability-card">
            <header className="demo-capability-card__head">
              <div>
                <span className="demo-capability-card__eyebrow">Document Preview</span>
                <h3 className="demo-capability-card__title">
                  {state.relativePath || 'docs/architecture-overview.md'}
                </h3>
              </div>
            </header>
            <div className="demo-preview-host">
              <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
            </div>
          </section>
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
        <span className="demo-stage-bar__label">{lastAction}</span>
        <div className="demo-stage-bar__actions">
          <button
            type="button"
            className="btn btn--primary demo-action-btn"
            onClick={() => setSearchOpen(true)}
          >
            Open Search Overlay
          </button>
        </div>
      </div>

      <div className="demo-search-export-grid">
        <section className="demo-capability-card">
          <header className="demo-capability-card__head">
            <div>
              <span className="demo-capability-card__eyebrow">Live BookmarksPanel</span>
              <h3 className="demo-capability-card__title">Saved Anchors &amp; Sort/Filter</h3>
            </div>
            <span className="demo-capability-card__pill">Interactive</span>
          </header>
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
          <header className="demo-capability-card__head">
            <div>
              <span className="demo-capability-card__eyebrow">Live Content Preview</span>
              <h3 className="demo-capability-card__title">
                {state.relativePath || 'docs/architecture-overview.md'}
              </h3>
            </div>
            <button
              type="button"
              className="demo-pill-btn"
              onClick={() => setSearchOpen(true)}
            >
              Search Workspace
            </button>
          </header>
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
