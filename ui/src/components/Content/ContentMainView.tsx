import type { AppState } from '../../contexts/appStateModel';
import { useHistoryView } from '../../contexts/HistoryContext';
import type { Translations } from '../../contexts/translations';
import { documentSessionKey, isDocumentDirty, type MarkdownEditMode } from '../../editor/documentSession';
import type { HtmlLocalFirstPolicyReport } from '../../markdown/htmlLocalFirstPreview';
import type { AppSettings } from '../../types';
import { DocumentDiffView } from '../History/DocumentDiffView';
import { GitRevisionView } from '../History/GitRevisionView';
import { AlertTriangleIcon, FileNotFoundIcon, FolderIcon, TrashIcon } from '../shared/icons';
import { DocumentBody } from './DocumentBody';
import type { PreviewNotice } from './documentPreviewNotice';
import { useDocumentEditingSurface } from './useDocumentEditingSurface';
import { WelcomePage } from './WelcomePage';
import { RandomTipCard } from './RandomTipCard';
import { useDocumentRootRegistration } from '../../document/useDocumentRootRegistration';


interface ContentMainViewProps {
  state: AppState; translations: Translations; scrollRef: React.RefObject<HTMLDivElement | null>; bodyRef: React.RefObject<HTMLDivElement | null>;
  isFullHtmlPreview: boolean; workspaceUnavailablePath: string | null; isDesktopTabView: boolean; isUnavailableWorkspaceInHistory: boolean;
  suppressWelcome: boolean; hasRenderableDocumentContent: boolean; isHtmlDocument: boolean; sourceDocumentText: string | null;
  htmlMarkdownRender: { html: string; error: string | null }; htmlDocumentPreviewEnabled: boolean; previewNotice: PreviewNotice | null;
  allowUpstreamHtmlPreview: boolean;
  frontmatterEntries: Array<[string, string]>;
  onCancelWorkspaceScan?: () => void; onOpenWorkspaceAgain: () => void; onDeleteUnavailableWorkspace: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void; onRefresh: () => void; onHtmlPolicyReport: (report: HtmlLocalFirstPolicyReport) => void;
  onWorkingDocumentSourceChange?: (filePath: string, source: string) => void; onSaveDocument?: (filePath: string) => void | Promise<unknown>;
  onDocumentModeChange?: (filePath: string, mode: MarkdownEditMode) => void;
}

export function ContentMainView(props: ContentMainViewProps) {
  const {
    state, translations: t, scrollRef, bodyRef, isFullHtmlPreview, workspaceUnavailablePath, isDesktopTabView,
    isUnavailableWorkspaceInHistory, suppressWelcome, hasRenderableDocumentContent, isHtmlDocument, sourceDocumentText,
    htmlMarkdownRender, htmlDocumentPreviewEnabled, allowUpstreamHtmlPreview, previewNotice, frontmatterEntries,
    onCancelWorkspaceScan, onOpenWorkspaceAgain, onDeleteUnavailableWorkspace, onUpdateSettings, onRefresh, onHtmlPolicyReport,
    onWorkingDocumentSourceChange, onSaveDocument, onDocumentModeChange,
  } = props;
  const { historyViews, clearHistoryView } = useHistoryView();
  const activeHistory = historyViews.single?.filePath === state.currentFile ? historyViews.single : undefined;
  const language = state.settings.language;
  const documentSession = state.currentFile ? state.documentSessions?.[documentSessionKey(state.currentFile)] : undefined;
  const editing = useDocumentEditingSurface({
    filePath: state.currentFile, mode: documentSession?.mode, source: documentSession?.source ?? '', hasSession: Boolean(documentSession),
    suspended: Boolean(activeHistory), bodyRef, renderVersion: state.renderVersion, language,
    saving: documentSession?.saveState === 'saving', dirty: documentSession ? isDocumentDirty(documentSession) : false,
    onSourceChange: (source) => { if (state.currentFile) onWorkingDocumentSourceChange?.(state.currentFile, source); },
    onSave: () => (state.currentFile ? onSaveDocument?.(state.currentFile) : undefined),
    onPreview: () => { if (state.currentFile) onDocumentModeChange?.(state.currentFile, 'rendered'); },
  });
  const isPlainMarkdownMode = editing.isPlainMode;

  useDocumentRootRegistration({ id: 'main', bodyRef, scrollRef, filePath: state.currentFile, markdownSource: state.markdownSource, renderVersion: state.renderVersion, active: true });

  return (
    <main className="content" id="mainContent">
      <div className={`content__scroll${isFullHtmlPreview ? ' content__scroll--html-preview' : ''}${isPlainMarkdownMode ? ' content__scroll--plain-edit' : ''}`} id="contentScroll" ref={scrollRef}>
        {state.isLoading && <div className="state-screen state-screen--loading" id="loadingScreen"><div className="spinner" /><div className="state-screen__title">{state.loadingLabel || t.ui.loadingDocs}</div>{state.loadingDetail && <div className="state-screen__sub">{state.loadingDetail}</div>}{onCancelWorkspaceScan && <button type="button" className="btn state-screen__cancel" onClick={onCancelWorkspaceScan}>{t.tooltips.cancelScan}</button>}</div>}
        {!state.isLoading && workspaceUnavailablePath && <div className="state-screen state-screen--workspace-unavailable"><div className="state-screen__icon state-screen__icon--warning"><AlertTriangleIcon size={34} /></div><div className="state-screen__title">{t.workspaceUnavailable.title}</div><div className="state-screen__sub">{t.workspaceUnavailable.description}</div><div className="state-screen__path">{workspaceUnavailablePath}</div>{isDesktopTabView && <div className="state-screen__hint">{t.workspaceUnavailable.tabHint}</div>}<div className="state-screen__actions"><button type="button" className="state-screen__button state-screen__button--primary" onClick={onOpenWorkspaceAgain}><FolderIcon size={14} /><span>{t.workspaceUnavailable.openAgain}</span></button><button type="button" className="state-screen__button state-screen__button--danger" onClick={onDeleteUnavailableWorkspace} disabled={!isUnavailableWorkspaceInHistory}><TrashIcon size={14} /><span>{isUnavailableWorkspaceInHistory ? t.workspaceUnavailable.deleteHistory : t.workspaceUnavailable.removedHistory}</span></button></div></div>}
        {!workspaceUnavailablePath && state.notFoundHref && <div className="state-screen"><div className="state-screen__icon">⚠️</div><div className="state-screen__title">{t.ui.fileNotFound}</div><div className="state-screen__sub state-screen__sub--path">{state.notFoundHref}</div></div>}
        {!state.isLoading && !state.isWorkspaceScanning && !state.notFoundHref && !workspaceUnavailablePath && state.fileList.length === 0 && !state.contentHtml && <div className="state-screen"><div className="state-screen__icon"><FileNotFoundIcon /></div><div className="state-screen__title">{state.settings.documentConversion ? t.ui.noSupportedDocuments : t.ui.noMarkdownDocuments}</div><div className="state-screen__sub">{state.settings.documentConversion ? t.ui.addSupportedDocuments : t.ui.addMarkdownDocuments}</div>{!state.settings.documentConversion && <button type="button" className="state-screen__button state-screen__button--primary" onClick={() => onUpdateSettings({ documentConversion: true })}>{t.ui.enableDocumentConversion}</button>}</div>}
        {!state.isLoading && !state.notFoundHref && !workspaceUnavailablePath && !suppressWelcome && !state.currentFile && state.fileList.length > 0 && <WelcomePage />}
        {!state.isLoading && !state.notFoundHref && !workspaceUnavailablePath && suppressWelcome && !state.currentFile && state.fileList.length > 0 && <RandomTipCard />}
        {!state.isLoading && !state.notFoundHref && !workspaceUnavailablePath && state.currentFile && hasRenderableDocumentContent && (
          <div className={`mdn-body${isFullHtmlPreview ? ' mdn-body--html-preview' : ''}`} id="mdBody" data-document-root="main" ref={bodyRef} aria-live="polite" data-mdn-source-document-path={state.relativePath || undefined}>
            {activeHistory?.mode === 'git-revision' && activeHistory.revision ? <GitRevisionView snapshot={activeHistory.revision} language={language} onReturnToCurrent={() => clearHistoryView('single')} />
              : activeHistory?.mode === 'diff' && activeHistory.comparison ? <DocumentDiffView {...activeHistory.comparison} language={language} onReturnToCurrent={() => clearHistoryView('single')} />
              : <DocumentBody
                rootId="main" filePath={state.currentFile} relativePath={state.relativePath} language={language || 'en'} translations={t}
                contentHtml={state.contentHtml || ''} frontmatterEntries={frontmatterEntries} toc={state.toc} tocCollapsed={state.tocCollapsed}
                stale={state.staleContentFilePath === state.currentFile} previewNotice={previewNotice}
                html={{ isHtmlDocument, sourceText: sourceDocumentText, markdownHtml: htmlMarkdownRender.html, previewEnabled: htmlDocumentPreviewEnabled, allowUpstreamResources: allowUpstreamHtmlPreview, error: htmlMarkdownRender.error }}
                onRefresh={onRefresh} onHtmlPolicyReport={onHtmlPolicyReport}
                {...editing.bodyProps}
              />}
          </div>
        )}
      </div>
      {editing.inlineEditor}
    </main>
  );
}
