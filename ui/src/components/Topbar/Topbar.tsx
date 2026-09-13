import { useAppState } from '../../contexts/AppStateContext';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { getExportScopeTranslations } from '../../contexts/exportScopeTranslations';
import { useNavigation } from '../../contexts/NavigationContext';
import { getTranslations } from '../../contexts/translations';
import { usePlatform } from '../../contexts/PlatformContext';
import { documentSessionKey, isDocumentDirty } from '../../editor/documentSession';
import { collectDirtyDocumentPaths } from '../../editor/unsavedGuards';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { TooltipButton } from '../shared/TooltipButton';
import { EditIcon } from '../shared/icons';
import { DocumentHeaderActions, NavigationHeaderActions } from '../shared/HeaderActionGroups';
import { ToolbarActionMenu } from '../shared/ToolbarActionMenu';
import { INSIGHTS_UI_TRANSLATIONS } from '../../contexts/insightsUiTranslations';
import logoUrl from '../../assets/logos/logo-500.png?inline';

interface TopbarProps {
  onSettingsOpen: () => void;
  onExportOpen: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCopyFile: (button?: HTMLElement | null) => void;
  hasUpdate?: boolean;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  isInsightsOpen?: boolean;
  onInsightsToggle?: () => void;
}

interface BreadcrumbItem { text: string; isBold?: boolean; isEllipsis?: boolean; }
const BREADCRUMB_CHAR_BUDGET = 96;

export function truncateFilename(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const extIdx = name.lastIndexOf('.');
  const ext = extIdx !== -1 ? name.slice(extIdx) : '';
  const base = extIdx !== -1 ? name.slice(0, extIdx) : name;
  const available = maxLen - 3 - ext.length;
  if (available > 2) {
    const startLen = Math.ceil(available / 2);
    const endLen = Math.floor(available / 2);
    return base.slice(0, startLen) + '...' + base.slice(-endLen) + ext;
  }
  return base.slice(0, Math.max(1, maxLen - 3)) + '...';
}

export function getBreadcrumbItems(relativePath: string, welcomePageLabel: string): BreadcrumbItem[] {
  if (!relativePath) return [];
  if (relativePath === 'Welcome Page') return [{ text: welcomePageLabel, isBold: true }];
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const count = parts.length;
  if (count === 0) return [];
  const filename = parts[count - 1];
  const getItemsLength = (items: BreadcrumbItem[]) => items.reduce((sum, item) => sum + item.text.length, 0) + (items.length - 1) * 3;
  const fullItems: BreadcrumbItem[] = parts.map((text, index) => ({ text, isBold: index === count - 1 }));
  if (getItemsLength(fullItems) <= BREADCRUMB_CHAR_BUDGET) return fullItems;
  if (count >= 4) {
    const items = [{ text: parts[0] }, { text: parts[1] }, { text: '...', isEllipsis: true }, { text: parts[count - 2] }, { text: filename, isBold: true }];
    if (getItemsLength(items) <= BREADCRUMB_CHAR_BUDGET) return items;
  }
  if (count >= 3) {
    const items = [{ text: parts[0] }, { text: '...', isEllipsis: true }, { text: parts[count - 2] }, { text: filename, isBold: true }];
    if (getItemsLength(items) <= BREADCRUMB_CHAR_BUDGET) return items;
  }
  if (count >= 2) {
    const parent = parts[count - 2];
    const items = [{ text: '...', isEllipsis: true }, { text: parent }, { text: filename, isBold: true }];
    if (getItemsLength(items) <= BREADCRUMB_CHAR_BUDGET) return items;
    const truncatedParent = parent.length > 28 ? parent.slice(0, 25) + '...' : parent;
    const truncated = [{ text: '...', isEllipsis: true }, { text: truncatedParent }, { text: filename, isBold: true }];
    if (getItemsLength(truncated) <= BREADCRUMB_CHAR_BUDGET) return truncated;
  }
  const truncatedFile = truncateFilename(filename, 48);
  return count >= 2 ? [{ text: '...', isEllipsis: true }, { text: truncatedFile, isBold: true }] : [{ text: truncatedFile, isBold: true }];
}

export function Topbar({
  onSettingsOpen, onExportOpen, onExpandAll, onCollapseAll, onCopyFile,
  hasUpdate = false, isFullscreen = false, onFullscreenToggle,
  isInsightsOpen = false, onInsightsToggle,
}: TopbarProps) {
  const {
    state, navigate, openInEditor, refresh, toggleTheme, toggleSidebar, toggleToc,
    toggleFocusMode, dispatch, setDocumentEditMode, saveDocument,
    guardUnsavedChanges = (_filePaths: string[], commit: () => void) => commit(),
  } = useAppState();
  const { back, forward, canGoBack, canGoForward } = useNavigation();
  const bridge = usePlatform();
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron || state.appRuntime === 'tauri';
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const editorT = getEditorUiTranslations(currentLang);
  const exportT = getExportScopeTranslations(currentLang).exportCenter;
  const insightsLang = currentLang as keyof typeof INSIGHTS_UI_TRANSLATIONS;
  const insightsT = INSIGHTS_UI_TRANSLATIONS[insightsLang] ?? INSIGHTS_UI_TRANSLATIONS.en;
  const isDark = state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeToggleLabel = isDark ? t.topbar.switchToLightMode : t.topbar.switchToDarkMode;
  const breadcrumbItems = getBreadcrumbItems(state.relativePath || '', t.topbar.welcomePage);
  const breakablePath = (state.currentFile || state.relativePath || '').replace(/[\/\\]/g, '$&' + '\u200B');
  const shouldExitTauriFullscreenOnRestore = state.appRuntime === 'tauri' && isFullscreen && onFullscreenToggle;
  const showsRestoreControl = state.isMaximized || isFullscreen;
  const activeDocumentSession = state.currentFile
    ? state.documentSessions?.[documentSessionKey(state.currentFile)]
    : undefined;
  const canSaveMarkdown = Boolean(
    activeDocumentSession
      && activeDocumentSession.saveState !== 'saving'
      && isDocumentDirty(activeDocumentSession),
  );
  const dirtyDocumentPaths = collectDirtyDocumentPaths(state.documentSessions ?? {});
  const guardDestructiveAction = (commit: () => void) => guardUnsavedChanges(dirtyDocumentPaths, commit);

  return (
    <header className="topbar">
      <div className="topbar__logo">
        <span className="topbar__logo-icon"><img src={logoUrl} width={20} height={20} alt="Markdown Explorer" className="topbar__logo-img" /></span>
        <div className="topbar__logo-text-group">
          <div className="topbar__logo-title">Markdown Explorer</div>
          <div className="topbar__logo-subtitle">by{' '}<a href="https://github.com/the-long-ride/markdown-explorer" target="_blank" rel="noopener noreferrer">the-long-ride</a>{' '}with ❤️</div>
        </div>
      </div>

      {(state.appRuntime === 'desktop' || state.appRuntime === 'chrome' || state.appRuntime === 'tauri') && (
        <>
          <span className="topbar__crumb-separator" aria-hidden="true">|</span>
          <TooltipButton
            className="btn btn--icon"
            onClick={() => guardDestructiveAction(() => {
              dispatch({
                type: 'READY_ACK', fileList: [], tree: null, theme: state.theme, themeStyle: state.themeStyle,
                defaultExpanded: state.defaultExpanded, workspaceName: '', recentWorkspaces: state.recentWorkspaces,
              });
              bridge.postMessage({ command: 'closeWorkspace' });
            })}
            tooltip={t.topbar.closeFolder}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>}
          />
        </>
      )}

      <span className="topbar__crumb-separator" aria-hidden="true">|</span>
      <NavigationHeaderActions onBack={back} onForward={forward} onRefresh={refresh} canGoBack={canGoBack} canGoForward={canGoForward} className="topbar__nav-actions" />

      <div className="topbar__breadcrumb-container">
        <div className="topbar__breadcrumb" id="breadcrumb">
          {breadcrumbItems.map((item, index) => (
            <span key={index}>
              {index > 0 && <span className="sep">/</span>}
              <span className={`topbar__breadcrumb-part${item.isBold ? ' topbar__breadcrumb-part--bold' : ''}${item.isEllipsis ? ' topbar__breadcrumb-part--ellipsis' : ''}`}>{item.text}</span>
            </span>
          ))}
        </div>
        {state.relativePath && state.relativePath !== 'Welcome Page' && <span className="tooltip-text">{breakablePath}</span>}
      </div>

      <div className="topbar__actions">
        <DocumentHeaderActions onCollapseAll={onCollapseAll} onExpandAll={onExpandAll} onCopyFile={onCopyFile} canCopyFile={!!state.currentFile} />
        {activeDocumentSession && state.currentFile && (
          <div className="topbar__markdown-editing" role="group" aria-label={editorT.modeGroup}>
            <button
              type="button"
              className="topbar__markdown-mode-btn"
              aria-pressed={activeDocumentSession.mode === 'rendered'}
              onClick={() => setDocumentEditMode(state.currentFile!, 'rendered')}
            >
              {editorT.rendered}
            </button>
            <button
              type="button"
              className="topbar__markdown-mode-btn"
              aria-pressed={activeDocumentSession.mode === 'inline-edit'}
              onClick={() => setDocumentEditMode(state.currentFile!, 'inline-edit')}
            >
              {editorT.inlineEdit}
            </button>
            <button
              type="button"
              className="topbar__markdown-mode-btn"
              aria-pressed={activeDocumentSession.mode === 'plain'}
              onClick={() => setDocumentEditMode(state.currentFile!, 'plain')}
            >
              {editorT.plain}
            </button>
            <button
              type="button"
              className="topbar__markdown-save-btn"
              disabled={!canSaveMarkdown}
              onClick={() => void saveDocument(state.currentFile!)}
            >
              {editorT.save}
            </button>
          </div>
        )}
        {state.appRuntime === 'vscode' && (
          <TooltipButton className="topbar__edit-action topbar__action-btn btn btn--icon" onClick={openInEditor} disabled={!state.currentFile} tooltip={t.topbar.edit} shortcut={getEnabledShortcut(state.settings, 'editCurrentDocument')} portalTooltip icon={<EditIcon size={13} />} />
        )}
        <ToolbarActionMenu
          triggerTooltip={t.topbar.moreActions}
          homeLabel={t.topbar.home}
          themeLabel={themeToggleLabel}
          editLabel={t.topbar.editLabel}
          settingsLabel={t.topbar.settings}
          exportLabel={exportT.title}
          homeTooltip={t.topbar.welcomePage}
          themeTooltip={themeToggleLabel}
          editTooltip={t.topbar.edit}
          settingsTooltip={hasUpdate ? t.topbar.settingsUpdate : t.topbar.settings}
          exportTooltip={exportT.exportDocumentsTooltip}
          homeShortcut={getEnabledShortcut(state.settings, 'welcome')}
          themeShortcut={getEnabledShortcut(state.settings, 'toggleTheme')}
          editShortcut={getEnabledShortcut(state.settings, 'editCurrentDocument')}
          settingsShortcut={getEnabledShortcut(state.settings, 'settings')}
          canEdit={(state.appRuntime === 'desktop' || state.appRuntime === 'tauri' || state.appRuntime === 'vscode') && !!state.currentFile}
          showEdit={state.appRuntime === 'desktop' || state.appRuntime === 'tauri'}
          isDark={isDark}
          hasUpdate={hasUpdate}
          onHome={() => navigate(null)}
          onTheme={toggleTheme}
          onEdit={openInEditor}
          onSettings={onSettingsOpen}
          onExport={onExportOpen}
          sidebarLabel={t.actions.toggleSidebar}
          sidebarTooltip={t.actions.toggleSidebar}
          sidebarShortcut={getEnabledShortcut(state.settings, 'toggleSidebar')}
          sidebarActive={!state.sidebarCollapsed}
          onSidebarToggle={toggleSidebar}
          tocLabel={t.actions.toggleToc}
          tocTooltip={t.actions.toggleToc}
          tocShortcut={getEnabledShortcut(state.settings, 'toggleToc')}
          tocActive={!state.tocCollapsed && !!state.currentFile && state.toc.length > 0}
          tocToggleDisabled={!state.currentFile || state.toc.length === 0}
          onTocToggle={toggleToc}
          showInsights={state.settings.insightsEnabled}
          insightsLabel={insightsT.title}
          insightsTooltip={insightsT.title}
          insightsShortcut={getEnabledShortcut(state.settings, 'toggleWorkspaceInsights')}
          insightsActive={isInsightsOpen}
          canInsights={!!(state.workspacePath || state.workspaceName)}
          onInsightsToggle={onInsightsToggle}
          focusModeLabel={t.actions.toggleFocusMode}
          focusModeTooltip={t.actions.toggleFocusMode}
          focusModeShortcut={getEnabledShortcut(state.settings, 'toggleFocusMode')}
          isFocusMode={state.focusMode}
          onFocusModeToggle={toggleFocusMode}
          showFullscreen={isDesktop}
          fullscreenLabel={t.actions.toggleFullscreen}
          fullscreenTooltip={t.actions.toggleFullscreenTooltip}
          fullscreenShortcut="F11"
          isFullscreen={isFullscreen}
          onFullscreenToggle={onFullscreenToggle}
          showResetZoom={isDesktop}
          resetZoomLabel={t.tooltips.resetZoom}
          resetZoomTooltip={t.tooltips.resetZoom}
          resetZoomShortcut={getEnabledShortcut(state.settings, 'resetZoom')}
          onResetZoom={() => bridge.postMessage({ command: 'zoom-reset' })}
        />

        {isDesktop && (
          <>
            <span className="topbar__crumb-separator topbar__crumb-separator--window-controls" aria-hidden="true">|</span>
            <div className="window-controls topbar__window-controls">
              <TooltipButton className="btn btn--icon window-control-btn" onClick={() => bridge.postMessage({ command: 'window-minimize' })} tooltip={t.tooltips.minimize} icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>} />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => { if (shouldExitTauriFullscreenOnRestore) onFullscreenToggle?.(); else bridge.postMessage({ command: 'window-maximize' }); }}
                tooltip={showsRestoreControl ? t.tooltips.restore : t.tooltips.maximize}
                icon={showsRestoreControl ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M8 8V3h13v13h-5" /><path d="M3 8h13v13H3z" /></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                )}
              />
              <TooltipButton className="btn btn--icon window-control-btn window-control-btn--close" onClick={() => guardDestructiveAction(() => bridge.postMessage({ command: 'window-close' }))} tooltip={t.tooltips.closeApp} tooltipAlign="right" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
