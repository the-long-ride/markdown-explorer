// =============================================================================
// website-app/src/features/FeaturesStudioApp.tsx
// Interactive Feature Showcase Studio + Embed Stage powered by real UI modules.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import appLogo from '../../../ui/assets/logos/logo-128.png';
import { CyberpunkMatrixBackdrop } from '../../../ui/src/components/shared/CyberpunkMatrixBackdrop';
import { CustomSelect } from '../../../ui/src/components/shared/CustomSelect';
import { HoverTooltipPortal } from '../../../ui/src/components/shared/HoverTooltipPortal';
import {
  ALL_THEME_STYLE_OPTIONS,
  AppStateProvider,
  useAppState,
} from '../../../ui/src/contexts/AppStateContext';
import { HistoryProvider } from '../../../ui/src/contexts/HistoryContext';
import { WorkspaceNavigationProvider } from '../../../ui/src/contexts/NavigationContext';
import { PlatformProvider } from '../../../ui/src/contexts/PlatformContext';
import { RepositorySnapshotFromHistoryProvider } from '../../../ui/src/contexts/RepositorySnapshotContext';
import type { PlatformBridge } from '../../../ui/src/platform/bridge';
import { createWebBridge } from '../../../ui/src/platform/web';
import type { ThemeStyle } from '../../../ui/src/types';
import { resolveThemeMode } from '../../../ui/src/utils/themeMode';
import { executeThemeTransition } from '../../../ui/src/utils/themeTransition';
import { FeatureStageRouter } from './FeatureStageRouter';
import { installDemoBusHost, type DemoHostController } from './demoBusHost';
import {
  FEATURE_DEMO_CATALOG,
  FEATURE_DEMO_CATEGORIES,
  getFeatureDemoItem,
  resolveFeatureSlug,
  type FeatureDemoSlug,
} from './demoCatalog';

const STUDIO_THEME_IDS: readonly ThemeStyle[] = [
  'raw-grid',
  'cyberpunk',
  'tokyo-night',
  'vercel',
  'bento',
  'neon-voltage',
  'default',
  'pet-k-ink',
  'pet-white-shiba',
];

function readInitialLocationState(): { slug: FeatureDemoSlug; isEmbed: boolean } {
  if (typeof window === 'undefined') return { slug: 'workspace', isEmbed: false };
  const params = new URLSearchParams(window.location.search);
  const rawSlug = params.get('feature') || window.location.hash;
  return {
    slug: resolveFeatureSlug(rawSlug),
    isEmbed: params.get('embed') === '1' || params.get('embed') === 'true',
  };
}

function createIsolatedDemoBridge(): PlatformBridge {
  const webBridge = createWebBridge();
  let memoryState: unknown = undefined;
  return {
    postMessage: (msg) => webBridge.postMessage(msg),
    onMessage: (handler) => webBridge.onMessage(handler),
    getState: <T,>() => memoryState as T | undefined,
    setState: <T,>(next: T) => {
      memoryState = next;
    },
    copyToClipboard: (text) => webBridge.copyToClipboard(text),
  };
}

interface StudioShellProps {
  readonly controller: DemoHostController;
  readonly initialSlug: FeatureDemoSlug;
  readonly isEmbed: boolean;
  readonly onRegisterSlugSync: (fn: (slug: FeatureDemoSlug) => void) => void;
}

function StudioShell({
  controller,
  initialSlug,
  isEmbed,
  onRegisterSlugSync,
}: StudioShellProps) {
  const { state, toggleTheme, setThemeStyle } = useAppState();
  const [activeSlug, setActiveSlug] = useState<FeatureDemoSlug>(initialSlug);
  const activeItem = useMemo(() => getFeatureDemoItem(activeSlug), [activeSlug]);
  const isDark = resolveThemeMode(state.theme) === 'dark';

  useEffect(() => {
    document.body.classList.add('feature-studio-body');
    return () => document.body.classList.remove('feature-studio-body');
  }, []);

  useEffect(() => {
    onRegisterSlugSync((nextSlug) => setActiveSlug(nextSlug));
  }, [onRegisterSlugSync]);

  const selectFeature = useCallback(
    (nextSlug: FeatureDemoSlug) => {
      setActiveSlug(nextSlug);
      controller.applyFeaturePreset(nextSlug);
      if (!isEmbed && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('feature', nextSlug);
        url.hash = nextSlug;
        window.history.replaceState(null, '', url.toString());
      }
    },
    [controller, isEmbed],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const next = resolveFeatureSlug(window.location.hash);
      setActiveSlug(next);
      controller.applyFeaturePreset(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [controller]);

  const styleOptions = useMemo(
    () =>
      STUDIO_THEME_IDS.map((id) => ALL_THEME_STYLE_OPTIONS.find((opt) => opt.id === id)).filter(
        (opt): opt is (typeof ALL_THEME_STYLE_OPTIONS)[number] => Boolean(opt),
      ),
    [],
  );

  const groupedCategories = useMemo(
    () =>
      FEATURE_DEMO_CATEGORIES.map((category) => ({
        category,
        items: FEATURE_DEMO_CATALOG.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [],
  );

  const studioHref = `/markdown-explorer/features/?feature=${encodeURIComponent(activeSlug)}`;

  const themeSelectOptions = useMemo(
    () => styleOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    [styleOptions],
  );

  const renderThemeSelect = () => (
    <CustomSelect
      className="feature-theme-select"
      aria-label="Theme style"
      value={state.themeStyle}
      options={themeSelectOptions}
      onChange={(nextStyle) => setThemeStyle(nextStyle)}
    />
  );

  const handleToggleTheme = (e: React.MouseEvent<HTMLButtonElement>) =>
    executeThemeTransition(toggleTheme, {
      originElement: e.currentTarget,
      event: e,
      nextTheme: isDark ? 'light' : 'dark',
    });

  if (isEmbed) {
    return (
      <div className="feature-embed-shell" data-testid="feature-embed-shell">
        <CyberpunkMatrixBackdrop />
        <HoverTooltipPortal />
        <header className="feature-embed-header">
          <div className="feature-embed-header__meta">
            <span className="feature-embed-header__title">{activeItem.title}</span>
          </div>
          <div className="feature-embed-header__controls">
            {renderThemeSelect()}
            <button type="button" className="btn feature-header-btn" onClick={handleToggleTheme}>
              {isDark ? 'Light' : 'Dark'}
            </button>
            <a className="btn btn--primary feature-header-btn" href={studioHref} target="_top">
              Expand &#8599;
            </a>
          </div>
        </header>
        <main className="feature-stage-frame">
          <FeatureStageRouter slug={activeSlug} onSelectDoc={(path) => controller.selectDoc(path)} />
        </main>
      </div>
    );
  }

  return (
    <div className="feature-studio-shell" data-testid="feature-studio-shell">
      <CyberpunkMatrixBackdrop />
      <HoverTooltipPortal />

      <header className="feature-studio-header">
        <div className="feature-studio-brand">
          <img className="feature-studio-brand__logo" src={appLogo} alt="Markdown Explorer" width={30} height={30} />
          <h1 className="feature-studio-brand__title">Component Studio</h1>
        </div>

        <div className="feature-studio-controls">
          <label className="feature-theme-picker">
            <span className="feature-theme-picker__label">Theme</span>
            {renderThemeSelect()}
          </label>
          <button type="button" className="btn feature-header-btn" onClick={handleToggleTheme}>
            {isDark ? 'Light' : 'Dark'}
          </button>
          <a
            className="btn feature-header-btn"
            href="/markdown-explorer/landing.html#video-demo"
            target="_top"
          >
            Video
          </a>
          <a className="btn feature-header-btn" href="/markdown-explorer/landing.html" target="_top">
            Home
          </a>
          <a
            className="btn btn--primary feature-header-btn"
            href="/markdown-explorer/app/?mode=test"
            target="_top"
          >
            Open App
          </a>
        </div>
      </header>

      <div className="feature-studio-layout">
        <nav
          className="feature-demo-sidebar"
          data-testid="feature-demo-sidebar"
          aria-label="Feature Demos"
        >
          <div className="feature-demo-sidebar__heading">
            <span>Features</span>
            <span className="feature-demo-sidebar__count">{FEATURE_DEMO_CATALOG.length}</span>
          </div>
          <div className="feature-demo-sidebar__list">
            {groupedCategories.map(({ category, items }) => (
              <section key={category} className="feature-demo-sidebar__group" aria-label={category}>
                <div className="feature-demo-sidebar__category">{category}</div>
                {items.map((item) => {
                  const isActive = item.slug === activeSlug;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      data-feature-slug={item.slug}
                      className={`feature-demo-nav-item${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => selectFeature(item.slug)}
                    >
                      <span className="feature-demo-nav-item__title">{item.title}</span>
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </nav>

        <section className="feature-studio-stage-col">
          <main className="feature-stage-frame">
            <FeatureStageRouter
              slug={activeSlug}
              onSelectDoc={(path) => controller.selectDoc(path)}
            />
          </main>
        </section>
      </div>
    </div>
  );
}

export function FeaturesStudioApp() {
  const initial = useMemo(() => readInitialLocationState(), []);
  const slugSyncRef = useRef<((slug: FeatureDemoSlug) => void) | null>(null);

  const registerSlugSync = useCallback((fn: (slug: FeatureDemoSlug) => void) => {
    slugSyncRef.current = fn;
  }, []);

  const { controller, bridge } = useMemo(() => {
    const hostController = installDemoBusHost({
      initialSlug: initial.slug,
      onSlugChange: (nextSlug) => {
        slugSyncRef.current?.(nextSlug);
      },
    });
    return { controller: hostController, bridge: createIsolatedDemoBridge() };
  }, [initial.slug]);

  useEffect(() => () => controller.dispose(), [controller]);

  return (
    <PlatformProvider bridge={bridge}>
      <AppStateProvider>
        <HistoryProvider>
          <RepositorySnapshotFromHistoryProvider>
            <WorkspaceNavigationProvider>
              <StudioShell
                controller={controller}
                initialSlug={initial.slug}
                isEmbed={initial.isEmbed}
                onRegisterSlugSync={registerSlugSync}
              />
            </WorkspaceNavigationProvider>
          </RepositorySnapshotFromHistoryProvider>
        </HistoryProvider>
      </AppStateProvider>
    </PlatformProvider>
  );
}
