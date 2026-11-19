// =============================================================================
// website-app/src/features/AuthoringStage.tsx
// Showcases Live Markdown Editor Modes (CodeMirror 6 + Inline Block/Table +
// Rendered) and Split View (SplitContent with swap, doc switcher, sync scroll).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Content } from '../../../ui/src/components/Content/Content';
import { SplitContent } from '../../../ui/src/components/Content/SplitContent';
import { MediaModal } from '../../../ui/src/components/Modal/MediaModal';
import { createMediaGallery, type MediaGallery } from '../../../ui/src/components/Modal/mediaGallery';
import { CustomSelect } from '../../../ui/src/components/shared/CustomSelect';
import { MarkdownEditingHeaderActions } from '../../../ui/src/components/shared/MarkdownEditingHeaderActions';
import { useAppState } from '../../../ui/src/contexts/AppStateContext';
import { getEditorUiTranslations } from '../../../ui/src/contexts/editorUiTranslations';
import { usePlatform } from '../../../ui/src/contexts/PlatformContext';
import {
  documentSessionKey,
  type MarkdownEditMode,
} from '../../../ui/src/editor/documentSession';
import { getEnabledShortcut } from '../../../ui/src/utils/shortcuts';

export interface AuthoringStageProps {
  readonly mode: 'live-editor' | 'split-view';
  readonly activeDocPath: string;
  readonly onSelectDoc: (path: string) => void;
}

const EDITOR_DOCS = [
  { path: 'docs/architecture-overview.md', label: 'Architecture' },
  { path: 'docs/metrics-benchmarks.md', label: 'Tables & Metrics' },
  { path: 'docs/release-playbook.md', label: 'Release Playbook' },
] as const;

const EDITOR_MODE_OPTIONS: readonly { mode: MarkdownEditMode; label: string; testId: string }[] = [
  { mode: 'plain', label: 'CodeMirror', testId: 'editor-mode-plain-btn' },
  { mode: 'inline-edit', label: 'Inline Edit', testId: 'editor-mode-inline-btn' },
  { mode: 'rendered', label: 'Reader', testId: 'editor-mode-rendered-btn' },
] as const;

const SPLIT_SECONDARY_DOCS = [
  { path: 'docs/release-playbook.md', label: 'Release Playbook' },
  { path: 'docs/metrics-benchmarks.md', label: 'Metrics & Charts' },
  { path: 'docs/design-system-themes.md', label: 'Design System' },
  { path: 'docs/architecture-overview.md', label: 'Architecture' },
] as const;

export function AuthoringStage({ mode, activeDocPath, onSelectDoc }: AuthoringStageProps) {
  const { state, dispatch, navigate, updateSettings, setDocumentEditMode, saveDocument } =
    useAppState();
  const bridge = usePlatform();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const splitHostRef = useRef<HTMLDivElement | null>(null);
  const enteredLiveEditorRef = useRef(false);
  const latestEditFileRef = useRef<string | null>(null);
  const syncingScrollRef = useRef(false);

  const [mediaGallery, setMediaGallery] = useState<MediaGallery | null>(null);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [secondaryDoc, setSecondaryDoc] = useState<string>('docs/release-playbook.md');

  const editTargetFile = state.currentFile || activeDocPath;
  const activeSession = editTargetFile
    ? state.documentSessions?.[documentSessionKey(editTargetFile)]
    : undefined;
  latestEditFileRef.current = activeSession?.filePath ?? editTargetFile ?? null;

  const handleImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) setMediaGallery(gallery);
  }, []);

  // Enter CodeMirror source mode automatically when opening live-editor.
  useEffect(() => {
    if (mode !== 'live-editor') {
      enteredLiveEditorRef.current = false;
      return;
    }
    if (state.splitView.enabled) dispatch({ type: 'CLOSE_SPLIT_VIEW' });
    if (!state.settings.markdownEditingEnabled) updateSettings({ markdownEditingEnabled: true });
    if (!enteredLiveEditorRef.current && activeSession) {
      enteredLiveEditorRef.current = true;
      if (activeSession.mode !== 'plain') {
        setDocumentEditMode(activeSession.filePath, 'plain');
      }
    }
  }, [
    activeSession,
    dispatch,
    mode,
    setDocumentEditMode,
    state.settings.markdownEditingEnabled,
    state.splitView.enabled,
    updateSettings,
  ]);

  useEffect(() => {
    if (mode !== 'live-editor') return;
    return () => {
      enteredLiveEditorRef.current = false;
      if (latestEditFileRef.current) setDocumentEditMode(latestEditFileRef.current, 'rendered');
    };
  }, [mode, setDocumentEditMode]);

  // Seed primary (architecture-overview) and secondary (release-playbook) for split-view.
  useEffect(() => {
    if (mode !== 'split-view' || !state.workspaceName || state.splitView.enabled) return;
    const hasPlaybook = state.contentTabs.some((t) => t.filePath === 'docs/release-playbook.md');
    const hasArch = state.contentTabs.some((t) => t.filePath === 'docs/architecture-overview.md');
    if (!hasPlaybook || !hasArch || state.currentFile !== 'docs/architecture-overview.md') {
      if (!hasPlaybook) bridge.postMessage({ command: 'navigate', path: 'docs/release-playbook.md' });
      if (!hasArch || state.currentFile !== 'docs/architecture-overview.md') {
        bridge.postMessage({ command: 'navigate', path: 'docs/architecture-overview.md' });
      }
      return;
    }
    setSecondaryDoc('docs/release-playbook.md');
    dispatch({ type: 'OPEN_SPLIT_VIEW', filePath: 'docs/release-playbook.md' });
  }, [
    bridge,
    dispatch,
    mode,
    state.contentTabs,
    state.currentFile,
    state.splitView.enabled,
    state.workspaceName,
  ]);

  useEffect(() => {
    if (mode !== 'split-view') return;
    return () => dispatch({ type: 'CLOSE_SPLIT_VIEW' });
  }, [dispatch, mode]);

  // Proportional scroll synchronization across split panes when enabled.
  useEffect(() => {
    if (mode !== 'split-view' || !syncScroll || !splitHostRef.current) return;
    const host = splitHostRef.current;
    const onScrollCapture = (event: Event) => {
      if (syncingScrollRef.current) return;
      const source = event.target;
      if (!(source instanceof HTMLElement) || !source.classList.contains('content__scroll')) return;
      const scrollers = Array.from(host.querySelectorAll<HTMLElement>('.content__scroll'));
      if (scrollers.length < 2) return;
      const ratio = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight);
      syncingScrollRef.current = true;
      for (const peer of scrollers) {
        if (peer !== source) {
          peer.scrollTop = Math.round(ratio * Math.max(0, peer.scrollHeight - peer.clientHeight));
        }
      }
      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };
    host.addEventListener('scroll', onScrollCapture, true);
    return () => host.removeEventListener('scroll', onScrollCapture, true);
  }, [mode, syncScroll]);

  const handleSecondaryDocChange = useCallback(
    (nextPath: string) => {
      setSecondaryDoc(nextPath);
      dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId: 'secondary' });
      dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId: 'secondary', filePath: nextPath });
      bridge.postMessage({ command: 'navigate', path: nextPath });
    },
    [bridge, dispatch],
  );

  if (mode === 'split-view') {
    const secondaryMode = state.splitView.secondary.mode;
    return (
      <div className="demo-content-stage" data-testid="demo-split-view-stage">
        <div className="demo-stage-bar demo-stage-bar--wrap">
          <div className="demo-stage-bar__actions">
            <CustomSelect
              className="feature-theme-select"
              aria-label="Secondary pane document"
              value={secondaryDoc}
              options={SPLIT_SECONDARY_DOCS.map((doc) => ({ value: doc.path, label: doc.label }))}
              onChange={(nextPath) => handleSecondaryDocChange(nextPath)}
            />
            <button
              type="button"
              className="demo-pill-btn"
              onClick={() => dispatch({ type: 'SWAP_SPLIT_PANES' })}
            >
              Swap
            </button>
            <button
              type="button"
              className={`demo-pill-btn${secondaryMode === 'plain' ? ' is-active' : ''}`}
              aria-pressed={secondaryMode === 'plain'}
              onClick={() =>
                dispatch({
                  type: 'SET_SPLIT_PANE_MODE',
                  paneId: 'secondary',
                  mode: secondaryMode === 'plain' ? 'rendered' : 'plain',
                })
              }
            >
              {secondaryMode === 'plain' ? 'Render' : 'CodeMirror'}
            </button>
            <button
              type="button"
              className={`demo-pill-btn${syncScroll ? ' is-active' : ''}`}
              aria-pressed={syncScroll}
              onClick={() => setSyncScroll((prev) => !prev)}
            >
              Sync Scroll
            </button>
          </div>
        </div>

        <div ref={splitHostRef} className="demo-stage-content-host">
          {state.splitView.enabled ? (
            <SplitContent onImageClick={handleImageClick} />
          ) : (
            <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
          )}
        </div>
        <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
      </div>
    );
  }

  const editorT = getEditorUiTranslations(state.settings.language);
  const currentMode: MarkdownEditMode = activeSession?.mode ?? 'rendered';

  return (
    <div className="demo-content-stage" data-testid="demo-live-editor-stage">
      <div className="demo-stage-bar demo-stage-bar--wrap">
        <div className="demo-doc-pills" role="group" aria-label="Editor modes">
          {EDITOR_MODE_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              className={`demo-pill-btn${currentMode === option.mode ? ' is-active' : ''}`}
              aria-pressed={currentMode === option.mode}
              data-testid={option.testId}
              onClick={() => {
                const target = activeSession?.filePath ?? editTargetFile;
                if (target) setDocumentEditMode(target, option.mode);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="demo-stage-bar__actions">
          <div className="demo-doc-pills" role="group" aria-label="Editor sample documents">
            {EDITOR_DOCS.map((doc) => {
              const active = editTargetFile === doc.path;
              return (
                <button
                  key={doc.path}
                  type="button"
                  className={`demo-pill-btn${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => {
                    navigate(doc.path);
                    onSelectDoc(doc.path);
                  }}
                >
                  {doc.label}
                </button>
              );
            })}
          </div>
          {activeSession && editTargetFile && (
            <MarkdownEditingHeaderActions
              filePath={editTargetFile}
              session={activeSession}
              labels={editorT}
              saveShortcut={getEnabledShortcut(state.settings, 'saveCurrentDocument')}
              editShortcut={getEnabledShortcut(state.settings, 'editCurrentDocument')}
              plainShortcut={getEnabledShortcut(state.settings, 'plainEditCurrentDocument')}
              onModeChange={setDocumentEditMode}
              onSave={saveDocument}
            />
          )}
        </div>
      </div>

      <div className="demo-stage-content-host">
        <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
      </div>
      <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
    </div>
  );
}
