// =============================================================================
// website-app/src/features/ThemesAndSettingsStage.tsx
// Interactive showcase for DesktopTabBar, all 9 Theme Styles, SettingsModal,
// ThemeRemixModal, and TourGuideOverlay over live rendered Markdown.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Content } from '../../../ui/src/components/Content/Content';
import { DesktopTabBar } from '../../../ui/src/components/Desktop/DesktopTabBar';
import { MediaModal } from '../../../ui/src/components/Modal/MediaModal';
import { createMediaGallery, type MediaGallery } from '../../../ui/src/components/Modal/mediaGallery';
import { SettingsModal } from '../../../ui/src/components/Settings/SettingsModal';
import { ThemeRemixModal } from '../../../ui/src/components/Settings/ThemeRemixModal';
import { TourGuideOverlay } from '../../../ui/src/components/Tour/TourGuideOverlay';
import {
  TOUR_STAGE_CHANGE_EVENT,
  requestStartUserTour,
  type TourStageChangeDetail,
} from '../../../ui/src/components/Tour/tourEvents';
import { ALL_THEME_STYLE_OPTIONS, useAppState } from '../../../ui/src/contexts/AppStateContext';
import { useNavigation } from '../../../ui/src/contexts/NavigationContext';
import { usePlatform } from '../../../ui/src/contexts/PlatformContext';
import type { DesktopTab } from '../../../ui/src/desktop/types';
import type { UpdateCheckState } from '../../../ui/src/hooks/useUpdateCheck';
import type { ThemeStyle, UpdateState } from '../../../ui/src/types';
import { resolveThemeMode } from '../../../ui/src/utils/themeMode';
import { executeThemeTransition } from '../../../ui/src/utils/themeTransition';
import {
  DEMO_DOCS,
  DEMO_FILES,
  DEMO_TREE,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_PATH,
} from './demoMarkdownFixtures';

export interface ThemesAndSettingsStageProps {
  readonly activeDocPath: string;
  readonly onSelectDoc: (path: string) => void;
}

const STUDIO_THEME_ORDER: readonly ThemeStyle[] = [
  'raw-grid', 'cyberpunk', 'tokyo-night', 'vercel', 'bento',
  'neon-voltage', 'default', 'pet-k-ink', 'pet-white-shiba',
];

const NEW_TAB_TEMPLATES = [
  { name: 'architecture-docs', doc: 'docs/architecture-overview.md' },
  { name: 'benchmarks-suite', doc: 'docs/metrics-benchmarks.md' },
  { name: 'release-engineering', doc: 'docs/release-playbook.md' },
  { name: 'theme-tokens', doc: 'docs/design-system-themes.md' },
] as const;

function createDemoTab(
  id: string,
  workspaceName: string,
  docPath: string,
  alias?: string,
): DesktopTab {
  const doc = DEMO_DOCS[docPath] ?? DEMO_DOCS['docs/design-system-themes.md'];
  return {
    id, kind: 'workspace', alias, workspaceName, workspacePath: `/workspace/${workspaceName}`,
    fileList: DEMO_FILES, tree: DEMO_TREE, currentFile: doc.path, contentHtml: '',
    markdownSource: doc.markdown, frontmatter: {}, toc: [], previewInfo: null,
    relativePath: doc.path, isLoading: false, notFoundHref: null,
    workspaceUnavailablePath: null, workspaceUnavailableReason: null,
    contentTabs: [], activeContentTabPath: null,
  };
}

function buildInitialTabs(): DesktopTab[] {
  return [
    createDemoTab('tab-core', DEMO_WORKSPACE_NAME, 'docs/design-system-themes.md'),
    createDemoTab('tab-metrics', 'benchmarks-suite', 'docs/metrics-benchmarks.md', 'benchmarks-suite'),
    createDemoTab('tab-release', 'release-notes', 'docs/release-playbook.md', 'release-notes'),
  ];
}

export function ThemesAndSettingsStage({ activeDocPath, onSelectDoc }: ThemesAndSettingsStageProps) {
  const { state, navigate, refresh, toggleTheme, setThemeStyle, toggleSidebar } = useAppState();
  const { back, forward, canGoBack, canGoForward } = useNavigation();
  const bridge = usePlatform();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextTabCounterRef = useRef(1);
  const [tabs, setTabs] = useState<DesktopTab[]>(buildInitialTabs);
  const [activeTabId, setActiveTabId] = useState<string>('tab-core');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);
  const [mediaGallery, setMediaGallery] = useState<MediaGallery | null>(null);
  const setStatusNote = useCallback((_note: string) => undefined, []);

  const isDark = resolveThemeMode(state.theme) === 'dark';

  useEffect(() => {
    const onTourStage = (event: Event) => {
      const detail = (event as CustomEvent<TourStageChangeDetail>).detail;
      if (detail?.openSettings) setSettingsOpen(true);
    };
    window.addEventListener(TOUR_STAGE_CHANGE_EVENT, onTourStage);
    return () => window.removeEventListener(TOUR_STAGE_CHANGE_EVENT, onTourStage);
  }, []);

  const openDoc = useCallback(
    (docPath: string) => { navigate(docPath); onSelectDoc(docPath); },
    [navigate, onSelectDoc],
  );

  const renderedTabs = useMemo(
    () =>
      tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab, currentFile: activeDocPath || tab.currentFile, contentHtml: state.contentHtml,
              markdownSource: state.markdownSource ?? tab.markdownSource, frontmatter: state.frontmatter,
              toc: state.toc, previewInfo: state.previewInfo,
              relativePath: state.relativePath || tab.relativePath,
              contentTabs: state.contentTabs, activeContentTabPath: state.activeContentTabPath,
            }
          : tab,
      ),
    [activeDocPath, activeTabId, state.activeContentTabPath, state.contentHtml, state.contentTabs,
      state.frontmatter, state.markdownSource, state.previewInfo, state.relativePath, state.toc, tabs],
  );

  const handleSelectTab = useCallback(
    (tabId: string) => {
      if (tabId === 'home') {
        const fallback = tabs[0];
        if (fallback) {
          setActiveTabId(fallback.id);
          openDoc('docs/architecture-overview.md');
          setStatusNote('Navigated to Architecture Overview from Home action.');
        }
        return;
      }
      setActiveTabId(tabId);
      const target = tabs.find((tab) => tab.id === tabId);
      if (target?.currentFile) {
        openDoc(target.currentFile);
        setStatusNote(`Switched to tab "${target.alias || target.workspaceName}" (${target.currentFile}).`);
      }
    },
    [openDoc, tabs],
  );

  const handleNewTab = useCallback(() => {
    const count = nextTabCounterRef.current;
    nextTabCounterRef.current += 1;
    const tpl = NEW_TAB_TEMPLATES[(count - 1) % NEW_TAB_TEMPLATES.length];
    const newId = `tab-demo-${count}`;
    const nextTab = createDemoTab(newId, `${tpl.name}-${count}`, tpl.doc);
    setTabs((prev) => [...prev, nextTab]);
    setActiveTabId(newId);
    openDoc(tpl.doc);
    setStatusNote(`Opened new workspace tab "${nextTab.workspaceName}".`);
  }, [openDoc]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          setStatusNote('Kept the last demo workspace tab open.');
          return prev;
        }
        const idx = prev.findIndex((tab) => tab.id === tabId);
        const remaining = prev.filter((tab) => tab.id !== tabId);
        if (tabId === activeTabId && remaining.length > 0) {
          const nextActive = remaining[Math.min(idx, remaining.length - 1)];
          setActiveTabId(nextActive.id);
          if (nextActive.currentFile) openDoc(nextActive.currentFile);
        }
        setStatusNote(`Closed tab "${tabId}".`);
        return remaining;
      });
    },
    [activeTabId, openDoc],
  );

  const handleReorderTabs = useCallback((sourceTabId: string, targetTabId: string) => {
    if (sourceTabId === targetTabId) return;
    setTabs((prev) => {
      const sourceIndex = prev.findIndex((t) => t.id === sourceTabId);
      const targetIndex = prev.findIndex((t) => t.id === targetTabId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setStatusNote('Reordered workspace tabs.');
  }, []);

  const handleCloseTabsToRight = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        if (idx === -1) return prev;
        const remaining = prev.slice(0, idx + 1);
        if (!remaining.some((t) => t.id === activeTabId) && remaining.length > 0) {
          const fallback = remaining[remaining.length - 1];
          setActiveTabId(fallback.id);
          if (fallback.currentFile) openDoc(fallback.currentFile);
        }
        return remaining;
      });
    },
    [activeTabId, openDoc],
  );

  const handleCloseOtherTabs = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const kept = prev.filter((t) => t.id === tabId);
        if (kept.length === 0) return prev;
        setActiveTabId(kept[0].id);
        if (kept[0].currentFile) openDoc(kept[0].currentFile);
        return kept;
      });
    },
    [openDoc],
  );

  const handleCloseAllTabs = useCallback(() => {
    const reset = buildInitialTabs().slice(0, 1);
    setTabs(reset);
    setActiveTabId(reset[0].id);
    if (reset[0].currentFile) openDoc(reset[0].currentFile);
    setStatusNote('Reset workspace tabs to default core tab.');
  }, [openDoc]);

  const handleAliasChange = useCallback((tabId: string, alias: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, alias: alias || undefined } : tab)),
    );
    setStatusNote(alias ? `Renamed tab alias to "${alias}".` : 'Cleared custom tab alias.');
  }, []);

  const handleImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) setMediaGallery(gallery);
  }, []);

  const themeCards = useMemo(
    () =>
      STUDIO_THEME_ORDER.map((id) => ALL_THEME_STYLE_OPTIONS.find((opt) => opt.id === id)).filter(
        (opt): opt is (typeof ALL_THEME_STYLE_OPTIONS)[number] => Boolean(opt),
      ),
    [],
  );

  const updateCheckStub = useMemo<UpdateCheckState>(
    () => ({
      checkNow: () => setStatusNote('Demo update check: running latest studio build.'),
      status: 'current',
      currentVersion: state.appVersion || '1.0.0',
      latestVersion: state.appVersion || '1.0.0',
      downloadUrl: '',
      canInstallUpdate: false,
      releaseUrl: 'https://github.com/the-long-ride/markdown-explorer/releases',
      changelogUrl: 'https://github.com/the-long-ride/markdown-explorer/releases',
      hasUpdate: false,
    }),
    [state.appVersion],
  );

  const hostUpdateStub = useMemo<UpdateState>(
    () => ({ status: 'idle', version: state.appVersion || '1.0.0' }),
    [state.appVersion],
  );

  return (
    <div className="app app--tab-view demo-themes-stage-app" data-testid="demo-themes-tabs-stage">
      <DesktopTabBar
        tabs={renderedTabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onReorderTabs={handleReorderTabs}
        onCloseTabsToRight={handleCloseTabsToRight}
        onCloseOtherTabs={handleCloseOtherTabs}
        onCloseAllTabs={handleCloseAllTabs}
        onAliasChange={handleAliasChange}
        onThemeToggle={toggleTheme}
        onSettingsOpen={() => setSettingsOpen(true)}
        onSidebarToggle={toggleSidebar}
        onBack={back}
        onForward={forward}
        onRefresh={refresh}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onCollapseAll={() => setStatusNote('Collapsed sections in preview.')}
        onExpandAll={() => setStatusNote('Expanded sections in preview.')}
        onCopyFile={() => void bridge.copyToClipboard(state.markdownSource ?? '')}
        isDark={isDark}
        isMaximized={false}
      />

      <div className="demo-stage-bar demo-stage-bar--wrap">
        <div className="demo-stage-bar__actions">
          <button
            type="button"
            className="btn btn--primary demo-action-btn"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
          <button type="button" className="btn demo-action-btn" onClick={() => setRemixOpen(true)}>
            Remix
          </button>
          <button
            type="button"
            className="btn demo-action-btn"
            onClick={() => requestStartUserTour()}
          >
            Tour
          </button>
          <button
            type="button"
            className="demo-pill-btn"
            onClick={(e) =>
              executeThemeTransition(toggleTheme, {
                originElement: e.currentTarget,
                event: e,
                nextTheme: isDark ? 'light' : 'dark',
              })
            }
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      <section className="demo-theme-cards-strip" aria-label="Theme style cards">
        {themeCards.map((opt) => {
          const active = state.themeStyle === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-theme-card={opt.id}
              className={`demo-theme-card demo-theme-card--${opt.id}${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => setThemeStyle(opt.id)}
            >
              <span className="demo-theme-card__swatch" aria-hidden="true" />
              <strong className="demo-theme-card__name">{opt.label}</strong>
            </button>
          );
        })}
      </section>

      <div className="demo-stage-content-host">
        <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
      </div>

      <SettingsModal
        isOpen={settingsOpen} onClose={() => setSettingsOpen(false)}
        updateCheck={updateCheckStub} hostUpdateState={hostUpdateStub}
        onDownloadUpdate={() => setStatusNote('Updates are disabled in browser demo mode.')}
        onScheduleUpdateOnExit={() => undefined} onRestartAndApplyUpdate={() => undefined}
        onOpenChangelog={() => setStatusNote('Changelog opens on GitHub Releases.')}
      />
      <ThemeRemixModal isOpen={remixOpen} onClose={() => setRemixOpen(false)} />
      <TourGuideOverlay />
      <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
    </div>
  );
}
