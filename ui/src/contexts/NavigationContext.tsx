// =============================================================================
// contexts/NavigationContext.tsx — Document history (back/forward)
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useAppState } from './AppStateContext';
import { usePlatform } from './PlatformContext';
import { resolveInsightsSettings } from '../insights/config';
import { loadInsightsSettingsConfig, INSIGHTS_SETTINGS_CHANGED_EVENT } from '../insights/settingsStore';
import { buildLazyWorkspaceWikiCatalog } from '../insights/workspaceInsightsSession';
import {
  parseWikiLink,
  resolveWikiLink,
  type WikiDocumentDescriptor,
  type WikiResolution,
} from '../markdown/wikiLinks';

export interface WikiNavigationResolver {
  resolve: (rawTarget: string, sourceDocumentPath: string) => WikiResolution | Promise<WikiResolution>;
}

interface NavigationContextValue {
  push: (fsPath: string) => void;
  setScope: (scopeId: string) => void;
  navigateWikiLink: (rawTarget: string, sourceDocumentPath: string) => Promise<WikiResolution>;
  back: () => void;
  forward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);
const DEFAULT_SCOPE_ID = 'default';

interface HistoryState {
  stack: string[];
  index: number;
  isNavigatingHistory: boolean;
}

interface WikiNavigateEventDetail {
  rawTarget: string;
  sourceDocumentPath: string;
}

interface WikiCatalogCache {
  workspaceKey: string;
  fileList: readonly unknown[];
  promise: Promise<WikiDocumentDescriptor[]>;
}

function normalizeDocumentPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '').normalize('NFC');
}

function expandFragmentParents(target: HTMLElement): void {
  let parent = target.closest('.mdn-section') as HTMLElement | null;
  while (parent) {
    parent.dataset.expanded = 'true';
    parent = (parent.parentElement?.closest('.mdn-section') as HTMLElement | null) ?? null;
  }
}

function renderedWikiFragment(canonicalPath: string, fragment: string): HTMLElement | null {
  const body = document.getElementById('mdBody');
  if (!(body instanceof HTMLElement)) return null;
  if (normalizeDocumentPath(body.dataset.mdnSourceDocumentPath ?? '') !== normalizeDocumentPath(canonicalPath)) return null;
  const target = document.getElementById(fragment);
  return target instanceof HTMLElement && body.contains(target) ? target : null;
}

function scrollWikiFragment(canonicalPath: string, fragment: string): boolean {
  const target = renderedWikiFragment(canonicalPath, fragment);
  if (!target) return false;
  expandFragmentParents(target);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  return true;
}

function watchWikiFragment(canonicalPath: string, fragment: string): () => void {
  if (scrollWikiFragment(canonicalPath, fragment)) return () => {};
  if (typeof MutationObserver === 'undefined' || !document.documentElement) return () => {};
  let stopped = false;
  const observer = new MutationObserver(() => {
    if (!stopped && scrollWikiFragment(canonicalPath, fragment)) stop();
  });
  const timeout = window.setTimeout(() => stop(), 10_000);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timeout);
    observer.disconnect();
  };
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return stop;
}

export function NavigationProvider({ children, wikiResolver }: { children: React.ReactNode; wikiResolver?: WikiNavigationResolver }) {
  return <NavigationProviderCore wikiResolver={wikiResolver}>{children}</NavigationProviderCore>;
}

export function WorkspaceNavigationProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAppState();
  const bridge = usePlatform();
  const catalogRef = useRef<WikiCatalogCache | null>(null);
  const workspaceKey = state.workspacePath || state.workspaceName || '';

  useEffect(() => {
    const invalidate = () => { catalogRef.current = null; };
    window.addEventListener(INSIGHTS_SETTINGS_CHANGED_EVENT, invalidate);
    return () => window.removeEventListener(INSIGHTS_SETTINGS_CHANGED_EVENT, invalidate);
  }, []);

  const resolve = useCallback(async (rawTarget: string, sourceDocumentPath: string): Promise<WikiResolution> => {
    if (!workspaceKey) return { status: 'missing' };
    let cached = catalogRef.current;
    if (!cached || cached.workspaceKey !== workspaceKey || cached.fileList !== state.fileList) {
      const config = loadInsightsSettingsConfig();
      const settings = resolveInsightsSettings(config.globalDefaults, config.workspaceOverrides[workspaceKey] ?? {});
      cached = { workspaceKey, fileList: state.fileList, promise: buildLazyWorkspaceWikiCatalog(bridge, undefined, settings) };
      catalogRef.current = cached;
    }
    let documents: WikiDocumentDescriptor[];
    try {
      documents = await cached.promise;
    } catch {
      if (catalogRef.current === cached) catalogRef.current = null;
      return { status: 'missing' };
    }
    const token = parseWikiLink(`[[${rawTarget}]]`);
    return resolveWikiLink(token, { sourceDocumentPath, documents });
  }, [bridge, state.fileList, workspaceKey]);

  const resolver = useMemo<WikiNavigationResolver>(() => ({ resolve }), [resolve]);
  return <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>;
}

function NavigationProviderCore({ children, wikiResolver }: { children: React.ReactNode; wikiResolver?: WikiNavigationResolver }) {
  const { navigate } = useAppState();
  const historiesRef = useRef<Record<string, HistoryState>>({});
  const scopeRef = useRef(DEFAULT_SCOPE_ID);
  const wikiFragmentCleanupRef = useRef<(() => void) | null>(null);
  const wikiNavigationGenerationRef = useRef(0);
  const [version, forceUpdate] = useReducer((state: number) => state + 1, 0);

  useEffect(() => () => {
    wikiNavigationGenerationRef.current += 1;
    wikiFragmentCleanupRef.current?.();
    wikiFragmentCleanupRef.current = null;
  }, []);

  const getHistory = useCallback((scopeId = scopeRef.current) => {
    if (!historiesRef.current[scopeId]) historiesRef.current[scopeId] = { stack: [], index: -1, isNavigatingHistory: false };
    return historiesRef.current[scopeId];
  }, []);

  const setScope = useCallback((scopeId: string) => {
    const nextScopeId = scopeId || DEFAULT_SCOPE_ID;
    if (scopeRef.current === nextScopeId) return;
    scopeRef.current = nextScopeId;
    getHistory(nextScopeId);
    forceUpdate();
  }, [getHistory]);

  const push = useCallback((fsPath: string) => {
    const history = getHistory();
    if (history.isNavigatingHistory) {
      history.isNavigatingHistory = false;
      forceUpdate();
      return;
    }
    if (history.index >= 0 && history.stack[history.index] === fsPath) return;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(fsPath);
    history.index = history.stack.length - 1;
    forceUpdate();
  }, [getHistory]);

  const navigateWikiLink = useCallback(async (rawTarget: string, sourceDocumentPath: string): Promise<WikiResolution> => {
    const generation = ++wikiNavigationGenerationRef.current;
    wikiFragmentCleanupRef.current?.();
    wikiFragmentCleanupRef.current = null;
    if (!wikiResolver) return { status: 'missing' };
    const resolution = await wikiResolver.resolve(rawTarget, sourceDocumentPath);
    if (generation !== wikiNavigationGenerationRef.current) return resolution;
    if (resolution.status !== 'resolved') return resolution;
    if (resolution.fragment) wikiFragmentCleanupRef.current = watchWikiFragment(resolution.canonicalPath, resolution.fragment);
    const sameDocument = normalizeDocumentPath(resolution.canonicalPath) === normalizeDocumentPath(sourceDocumentPath);
    if (!sameDocument || !resolution.fragment) navigate(resolution.canonicalPath);
    return resolution;
  }, [navigate, wikiResolver]);

  useEffect(() => {
    const onWikiNavigate = (event: Event) => {
      const detail = (event as CustomEvent<WikiNavigateEventDetail>).detail;
      if (!detail || typeof detail.rawTarget !== 'string' || typeof detail.sourceDocumentPath !== 'string') return;
      void navigateWikiLink(detail.rawTarget, detail.sourceDocumentPath);
    };
    window.addEventListener('mdn-wiki-navigate', onWikiNavigate);
    return () => window.removeEventListener('mdn-wiki-navigate', onWikiNavigate);
  }, [navigateWikiLink]);

  const back = useCallback(() => {
    const history = getHistory();
    if (history.index <= 0) return;
    history.isNavigatingHistory = true;
    history.index -= 1;
    navigate(history.stack[history.index]);
    forceUpdate();
  }, [getHistory, navigate]);

  const forward = useCallback(() => {
    const history = getHistory();
    if (history.index >= history.stack.length - 1) return;
    history.isNavigatingHistory = true;
    history.index += 1;
    navigate(history.stack[history.index]);
    forceUpdate();
  }, [getHistory, navigate]);

  const value = useMemo<NavigationContextValue>(() => {
    const history = getHistory();
    return { push, setScope, navigateWikiLink, back, forward, canGoBack: history.index > 0, canGoForward: history.index < history.stack.length - 1 };
  }, [back, forward, getHistory, navigateWikiLink, push, setScope, version]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
