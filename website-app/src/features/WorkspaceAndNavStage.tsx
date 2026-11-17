// =============================================================================
// website-app/src/features/WorkspaceAndNavStage.tsx
// Showcases WorkspaceSelection + WelcomePage (workspace-home) and
// Sidebar (Files/Search/Bookmarks) + ScopeViewModal + TableOfContents (sidebar-toc).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBookmarkWorkspaceKey } from '../../../ui/src/bookmarks/bookmarkModel';
import { bookmarkStore } from '../../../ui/src/bookmarks/bookmarkStore';
import type { BookmarkRecord, OpenBookmarkWorkspace } from '../../../ui/src/bookmarks/types';
import { Content } from '../../../ui/src/components/Content/Content';
import { WelcomePage } from '../../../ui/src/components/Content/WelcomePage';
import { MediaModal } from '../../../ui/src/components/Modal/MediaModal';
import { ScopeViewModal } from '../../../ui/src/components/Modal/ScopeViewModal';
import { createMediaGallery, type MediaGallery } from '../../../ui/src/components/Modal/mediaGallery';
import { Sidebar } from '../../../ui/src/components/Sidebar/Sidebar';
import { TableOfContents } from '../../../ui/src/components/TOC/TableOfContents';
import { WorkspaceSelection } from '../../../ui/src/components/Workspace/WorkspaceSelection';
import { useAppState } from '../../../ui/src/contexts/AppStateContext';
import { usePlatform } from '../../../ui/src/contexts/PlatformContext';
import {
  DEMO_FILES,
  DEMO_RECENT_WORKSPACES,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_PATH,
} from './demoMarkdownFixtures';

export interface WorkspaceAndNavStageProps {
  readonly mode: 'workspace-home' | 'sidebar-toc';
  readonly activeDocPath: string;
  readonly onSelectDoc: (path: string) => void;
}

function seedSidebarBookmarks(workspaceKey: string): void {
  const existing = bookmarkStore
    .getSnapshot()
    .items.filter((item) => item.workspaceKey === workspaceKey);
  if (existing.length > 0) return;

  const now = 1731880000000;
  const seeds: Array<{ id: string; name: string; filePath: string; text: string }> = [
    {
      id: 'nav-bm-arch',
      name: 'Runtime Pipeline Diagram',
      filePath: 'docs/architecture-overview.md',
      text: 'Markdown Explorer renders local documentation folders into an interactive, zero-telemetry workspace.',
    },
    {
      id: 'nav-bm-metrics',
      name: 'Engine Cold-Start Benchmarks',
      filePath: 'docs/metrics-benchmarks.md',
      text: 'Rust Tauri: 180 ms cold start, 42 MB idle RAM, 14 ms search over 1k docs.',
    },
    {
      id: 'nav-bm-release',
      name: 'Release Verification Gate',
      filePath: 'docs/release-playbook.md',
      text: 'Every release candidate must verify source line-count limits, strict TypeScript typechecking',
    },
  ];

  for (const seed of seeds) {
    bookmarkStore.add({
      id: seed.id,
      name: seed.name,
      workspaceKey,
      workspaceName: DEMO_WORKSPACE_NAME,
      workspacePath: DEMO_WORKSPACE_PATH,
      filePath: seed.filePath,
      targetKind: 'text',
      sourceAnchor: {
        start: 0,
        end: seed.text.length,
        fragment: seed.text,
        fingerprint: seed.id,
        occurrence: 0,
        prefix: '',
        suffix: '',
      },
      renderedText: seed.text,
      selectedText: seed.text,
      matchOrdinal: 0,
      matchIndex: 0,
      prefix: '',
      suffix: '',
      createdAt: now,
      updatedAt: now,
    });
  }
}

export function WorkspaceAndNavStage({
  mode,
  activeDocPath,
  onSelectDoc,
}: WorkspaceAndNavStageProps) {
  const { state, navigate, setSidebarCollapsed, setSidebarActiveTab } = useAppState();
  const bridge = usePlatform();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [homeSubView, setHomeSubView] = useState<'selection' | 'welcome'>('selection');
  const [workspaceAliases, setWorkspaceAliases] = useState<Record<string, string>>({});
  const [statusNotice, setStatusNotice] = useState<string>('');
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [mediaGallery, setMediaGallery] = useState<MediaGallery | null>(null);

  const workspaceKey = getBookmarkWorkspaceKey(
    state.workspacePath ?? DEMO_WORKSPACE_PATH,
    state.workspaceName || DEMO_WORKSPACE_NAME,
  );

  useEffect(() => {
    seedSidebarBookmarks(workspaceKey);
  }, [workspaceKey]);

  useEffect(() => {
    if (mode === 'sidebar-toc' && state.sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
  }, [mode, setSidebarCollapsed, state.sidebarCollapsed]);

  useEffect(() => {
    if (mode !== 'workspace-home') return;
    const onOpenSelection = () => setHomeSubView('selection');
    const onOpenHomepage = () => setHomeSubView('welcome');
    window.addEventListener('open-workspace-selection', onOpenSelection);
    window.addEventListener('open-homepage', onOpenHomepage);
    return () => {
      window.removeEventListener('open-workspace-selection', onOpenSelection);
      window.removeEventListener('open-homepage', onOpenHomepage);
    };
  }, [mode]);

  const bookmarkWorkspaces = useMemo<OpenBookmarkWorkspace[]>(
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

  const handleImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) setMediaGallery(gallery);
  }, []);

  const handleBookmarkNavigate = useCallback(
    (bookmark: BookmarkRecord) => {
      navigate(bookmark.filePath);
      onSelectDoc(bookmark.filePath);
      setStatusNotice(`Jumped to bookmark "${bookmark.name}" (${bookmark.filePath})`);
    },
    [navigate, onSelectDoc],
  );

  const handleCreateVirtual = useCallback(() => {
    bridge.postMessage({
      command: 'createVirtualWorkspace',
      type: 'createVirtualWorkspace',
      name: 'virtual-scratchpad',
    });
    setStatusNotice('Switched to virtual scratchpad workspace (in-memory demo)');
  }, [bridge]);

  const handleResetDemoWorkspace = useCallback(() => {
    bridge.postMessage({ command: 'openFolder', openFirstFile: true });
    onSelectDoc('docs/architecture-overview.md');
    setStatusNotice(`Opened ${DEMO_WORKSPACE_NAME}`);
  }, [bridge, onSelectDoc]);

  const recentsList =
    state.recentWorkspaces.length > 0 ? state.recentWorkspaces : DEMO_RECENT_WORKSPACES;

  if (mode === 'workspace-home') {
    const activeWorkspaceLabel = state.workspaceName || DEMO_WORKSPACE_NAME;
    const activeDocLabel = state.currentFile || activeDocPath;

    return (
      <div className="demo-workspace-home-stage" data-testid="demo-workspace-home-stage">
        <div className="demo-stage-bar demo-stage-bar--wrap">
          <div className="demo-doc-pills" role="group" aria-label="Home sub-views">
            <button
              type="button"
              className={`demo-pill-btn${homeSubView === 'selection' ? ' is-active' : ''}`}
              aria-pressed={homeSubView === 'selection'}
              data-testid="home-subview-selection"
              onClick={() => setHomeSubView('selection')}
            >
              Workspace Selection ({recentsList.length} recents)
            </button>
            <button
              type="button"
              className={`demo-pill-btn${homeSubView === 'welcome' ? ' is-active' : ''}`}
              aria-pressed={homeSubView === 'welcome'}
              data-testid="home-subview-welcome"
              onClick={() => setHomeSubView('welcome')}
            >
              Welcome Launchpad &amp; Guide
            </button>
          </div>

          <div className="demo-stage-bar__actions">
            <span className="demo-stage-bar__label">
              Active: <strong>{activeWorkspaceLabel}</strong> ({activeDocLabel})
            </span>
            <button
              type="button"
              className="demo-pill-btn"
              data-testid="demo-trigger-virtual-workspace"
              onClick={handleCreateVirtual}
            >
              + New Virtual Workspace
            </button>
            <button
              type="button"
              className="demo-pill-btn"
              onClick={handleResetDemoWorkspace}
            >
              Open Demo Doc
            </button>
          </div>
        </div>

        {statusNotice && (
          <div className="demo-stage-bar demo-stage-bar--notice" role="status">
            <span className="demo-stage-bar__label">{statusNotice}</span>
          </div>
        )}

        <div className="demo-stage-content-host demo-workspace-home-host">
          {homeSubView === 'selection' ? (
            <WorkspaceSelection
              embeddedInTabs={true}
              workspaceAliases={workspaceAliases}
              onOpenHomepage={() => setHomeSubView('welcome')}
              onWorkspaceAliasChange={(path, alias) =>
                setWorkspaceAliases((prev) => ({ ...prev, [path]: alias }))
              }
            />
          ) : (
            <WelcomePage />
          )}
        </div>
      </div>
    );
  }

  const scopeFiles = state.fileList.length > 0 ? state.fileList : DEMO_FILES;
  const currentTarget = state.currentFile || activeDocPath;
  const initialScopeFile =
    scopeFiles.find((file) => file.relativePath === currentTarget || file.fsPath === currentTarget) ??
    scopeFiles[0] ??
    null;

  return (
    <div className="demo-sidebar-toc-stage" data-testid="demo-sidebar-toc-stage">
      <div className="demo-stage-bar demo-stage-bar--wrap">
        <div className="demo-doc-pills" role="group" aria-label="Sidebar tabs">
          <span className="demo-stage-bar__label">Sidebar Tab:</span>
          {(['files', 'search', 'bookmarks'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`demo-pill-btn${state.sidebarActiveTab === tab ? ' is-active' : ''}`}
              aria-pressed={state.sidebarActiveTab === tab}
              onClick={() => setSidebarActiveTab(tab)}
            >
              {tab === 'files' ? 'Files & Scope' : tab === 'search' ? 'Search' : 'Bookmarks'}
            </button>
          ))}
        </div>

        <div className="demo-stage-bar__actions">
          <button
            type="button"
            className="demo-pill-btn is-active"
            data-testid="open-scope-view-btn"
            onClick={() => setScopeModalOpen(true)}
          >
            Open Scope View Modal ({scopeFiles.length} docs)
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="demo-stage-bar demo-stage-bar--notice" role="status">
          <span className="demo-stage-bar__label">{statusNotice}</span>
        </div>
      )}

      <div className="body demo-sidebar-toc-body">
        <Sidebar
          bookmarkViewMode="tabs"
          bookmarkWorkspaces={bookmarkWorkspaces}
          activeBookmarkWorkspaceKey={workspaceKey}
          onBookmarkNavigate={handleBookmarkNavigate}
        />
        <div className="content-shell">
          <div className="content-shell__main">
            <Content
              onImageClick={handleImageClick}
              scrollRef={scrollRef}
              suppressWelcome={true}
            />
          </div>
        </div>
        {state.toc.length > 0 && <TableOfContents variant="panel" />}
      </div>

      {scopeModalOpen && (
        <ScopeViewModal
          initialFile={initialScopeFile}
          files={scopeFiles}
          onClose={() => setScopeModalOpen(false)}
          onMediaClick={handleImageClick}
        />
      )}
      <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
    </div>
  );
}
