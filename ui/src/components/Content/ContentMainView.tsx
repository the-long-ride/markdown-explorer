import { lazy, memo, Suspense } from 'react';
import type { AppState } from '../../contexts/appStateModel';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { useHistoryView } from '../../contexts/HistoryContext';
import type { Translations } from '../../contexts/translations';
import { documentSessionKey } from '../../editor/documentSession';
import type { HtmlLocalFirstPolicyReport } from '../../markdown/htmlLocalFirstPreview';
import type { AppSettings } from '../../types';
import { DocumentDiffView } from '../History/DocumentDiffView';
import { GitRevisionView } from '../History/GitRevisionView';
import { AlertTriangleIcon, FileNotFoundIcon, FolderIcon, TrashIcon } from '../shared/icons';
import { HtmlDocumentView } from './HtmlDocumentView';
import { InlineMarkdownEditor } from './InlineMarkdownEditor';
import { PlainMarkdownEditor } from './PlainMarkdownEditor';
import { useInlineMarkdownEditing } from './useInlineMarkdownEditing';
import { WelcomePage } from './WelcomePage';
import { RandomTipCard } from './RandomTipCard';

const TableOfContents = lazy(() => import('../TOC/TableOfContents').then((module) => ({ default: module.TableOfContents })));
const HtmlContent = memo(function HtmlContent({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: html }} />; });

interface ContentMainViewProps {
  state: AppState; translations: Translations; scrollRef: React.RefObject<HTMLDivElement | null>; bodyRef: React.RefObject<HTMLDivElement | null>;
  isFullHtmlPreview: boolean; workspaceUnavailablePath: string | null; isDesktopTabView: boolean; isUnavailableWorkspaceInHistory: boolean;
  suppressWelcome: boolean; hasRenderableDocumentContent: boolean; isHtmlDocument: boolean; sourceDocumentText: string | null;
  htmlMarkdownRender: { html: string; error: string | null }; htmlDocumentPreviewEnabled: boolean; previewTitle: string; previewWarning: string;
  previewMeta: string; frontmatterEntries: Array<[string, string]>; renderedContentParts: { leadingCommentsHtml: string; bodyHtml: string };
  onCancelWorkspaceScan?: () => void; onOpenWorkspaceAgain: () => void; onDeleteUnavailableWorkspace: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void; onRefresh: () => void; onHtmlPolicyReport: (report: HtmlLocalFirstPolicyReport) => void;
  onWorkingDocumentSourceChange?: (filePath: string, source: string) => void; onSaveDocument?: (filePath: string) => void | Promise<unknown>;
}

export function ContentMainView(props: ContentMainViewProps) {
  const {
    state, translations: t, scrollRef, bodyRef, isFullHtmlPreview, workspaceUnavailablePath, isDesktopTabView,
    isUnavailableWorkspaceInHistory, suppressWelcome, hasRenderableDocumentContent, isHtmlDocument, sourceDocumentText,
    htmlMarkdownRender, htmlDocumentPreviewEnabled, previewTitle, previewWarning, previewMeta, frontmatterEntries, renderedContentParts,
    onCancelWorkspaceScan, onOpenWorkspaceAgain, onDeleteUnavailableWorkspace, onUpdateSettings, onRefresh, onHtmlPolicyReport,
    onWorkingDocumentSourceChange, onSaveDocument,
  } = props;
  const { historyViews, clearHistoryView } = useHistoryView();
  const activeHistory = historyViews.single?.filePath === state.currentFile ? historyViews.single : undefined;
  const previewInfo = state.previewInfo;
  const previewCopy = t.documentPreview;
  const language = state.settings.language;
  const editorT = getEditorUiTranslations(language);
  const documentSession = state.currentFile ? state.documentSessions?.[documentSessionKey(state.currentFile)] : undefined;
  const isPlainMarkdownMode = !activeHistory && documentSession?.mode === 'plain';
  const inlineEditing = useInlineMarkdownEditing({
    enabled: !activeHistory && documentSession?.mode === 'inline-edit', bodyRef, source: documentSession?.source ?? '', renderVersion: state.renderVersion,
    editLabel: editorT.inlineEdit, onSourceChange: (source) => { if (state.currentFile) onWorkingDocumentSourceChange?.(state.currentFile, source); },
  });

  return (
    <main className="content" id="mainContent">
      <div className={`content__scroll${isFullHtmlPreview ? ' content__scroll--html-preview' : ''}`} id="contentScroll" ref={scrollRef}>
        {state.isLoading && <div className="state-screen state-screen--loading" id="loadingScreen"><div className="spinner" /><div className="state-screen__title">{state.loadingLabel || t.ui.loadingDocs}</div>{state.loadingDetail && <div className="state-screen__sub">{state.loadingDetail}</div>}{onCancelWorkspaceScan && <button type="button" className="btn state-screen__cancel" onClick={onCancelWorkspaceScan}>{t.tooltips.cancelScan}</button>}</div>}
        {!state.isLoading && workspaceUnavailablePath && <div className="state-screen state-screen--workspace-unavailable"><div className="state-screen__icon state-screen__icon--warning"><AlertTriangleIcon size={34} /></div><div className="state-screen__title">{t.workspaceUnavailable.title}</div><div className="state-screen__sub">{t.workspaceUnavailable.description}</div><div className="state-screen__path">{workspaceUnavailablePath}</div>{isDesktopTabView && <div className="state-screen__hint">{t.workspaceUnavailable.tabHint}</div>}<div className="state-screen__actions"><button type="button" className="state-screen__button state-screen__button--primary" onClick={onOpenWorkspaceAgain}><FolderIcon size={14} /><span>{t.workspaceUnavailable.openAgain}</span></button><button type="button" className="state-screen__button state-screen__button--danger" onClick={onDeleteUnavailableWorkspace} disabled={!isUnavailableWorkspaceInHistory}><TrashIcon size={14} /><span>{isUnavailableWorkspaceInHistory ? t.workspaceUnavailable.deleteHistory : t.workspaceUnavailable.removedHistory}</span></button></div></div>}
        {!workspaceUnavailablePath && state.notFoundHref && <div className="state-screen"><div className="state-screen__icon">⚠️</div><div className="state-screen__title">{t.ui.fileNotFound}</div><div className="state-screen__sub state-screen__sub--path">{state.notFoundHref}</div></div>}
        {!state.isLoading && !state.isWorkspaceScanning && !state.notFoundHref && !workspaceUnavailablePath && state.fileList.length === 0 && !state.contentHtml && <div className="state-screen"><div className="state-screen__icon"><FileNotFoundIcon /></div><div className="state-screen__title">{state.settings.documentConversion ? t.ui.noSupportedDocuments : t.ui.noMarkdownDocuments}</div><div className="state-screen__sub">{state.settings.documentConversion ? t.ui.addSupportedDocuments : t.ui.addMarkdownDocuments}</div>{!state.settings.documentConversion && <button type="button" className="state-screen__button state-screen__button--primary" onClick={() => onUpdateSettings({ documentConversion: true })}>{t.ui.enableDocumentConversion}</button>}</div>}
        {!state.isLoading && !state.notFoundHref && !workspaceUnavailablePath && !suppressWelcome && !state.currentFile && state.fileList.length > 0 && <WelcomePage />}
        {!state.isLoading && !state.notFoundHref && !workspaceUnavailablePath && suppressWelcome && !state.currentFile && state.fileList.length > 0 && <RandomTipCard />}
        {!state.isLoading && !state.notFoundHref && !workspaceUnavailablePath && state.currentFile && hasRenderableDocumentContent && (
          <div className={`mdn-body${isFullHtmlPreview ? ' mdn-body--html-preview' : ''}`} id="mdBody" ref={bodyRef} aria-live="polite" data-mdn-source-document-path={state.relativePath || undefined}>
            {state.staleContentFilePath === state.currentFile && <div className="document-preview-notice current-file-change-notice" role="status"><AlertTriangleIcon size={16} /><div className="document-preview-notice__body current-file-change-notice__body"><span>{previewCopy.currentFileChangedOnDisk}</span><button type="button" className="btn current-file-change-notice__button" onClick={onRefresh}>{previewCopy.refreshCurrentFile}</button><span>{previewCopy.currentFileChangedSuffix}</span></div></div>}
            {activeHistory?.mode === 'git-revision' && activeHistory.revision ? <GitRevisionView snapshot={activeHistory.revision} language={language} onReturnToCurrent={() => clearHistoryView('single')} />
              : activeHistory?.mode === 'diff' && activeHistory.comparison ? <DocumentDiffView {...activeHistory.comparison} language={language} onReturnToCurrent={() => clearHistoryView('single')} />
              : isHtmlDocument && sourceDocumentText !== null ? <HtmlDocumentView filePath={state.currentFile} htmlSource={sourceDocumentText} markdownHtml={htmlMarkdownRender.html} previewEnabled={htmlDocumentPreviewEnabled} title={state.relativePath || state.currentFile} conversionError={htmlMarkdownRender.error} onPolicyReport={onHtmlPolicyReport} />
              : isPlainMarkdownMode && documentSession ? <PlainMarkdownEditor value={documentSession.source} disabled={documentSession.saveState === 'saving'} ariaLabel={editorT.plainSourceLabel} onChange={(source) => onWorkingDocumentSourceChange?.(state.currentFile!, source)} onSave={() => { void onSaveDocument?.(state.currentFile!); }} />
              : <>{previewInfo && <div className={`document-preview-notice document-preview-notice--${previewInfo.kind}`} role="note"><AlertTriangleIcon size={16} /><div className="document-preview-notice__body"><div className="document-preview-notice__title">{previewTitle}</div><div className="document-preview-notice__text">{previewWarning}</div>{previewMeta && <div className="document-preview-notice__meta">{previewMeta}</div>}</div></div>}{state.toc.length > 0 && !state.tocCollapsed && <Suspense fallback={null}><TableOfContents variant="compact" /></Suspense>}{renderedContentParts.leadingCommentsHtml && <HtmlContent html={renderedContentParts.leadingCommentsHtml} />}{frontmatterEntries.length > 0 && <details className="mdn-frontmatter" open aria-label={t.ui.documentProperties}><summary className="mdn-frontmatter-summary"><span>{t.ui.properties}</span><span className="mdn-frontmatter-count">{frontmatterEntries.length} {frontmatterEntries.length === 1 ? t.ui.propertySingular : t.ui.propertyPlural}</span></summary><div className="mdn-frontmatter-grid">{frontmatterEntries.map(([key, value]) => <div className="mdn-frontmatter-field" key={key}><span className="mdn-frontmatter-key">{key}</span><span className={`mdn-frontmatter-value${value ? '' : ' is-empty'}`}>{value || '\u00a0'}</span></div>)}</div></details>}<HtmlContent html={renderedContentParts.bodyHtml} /></>}
          </div>
        )}
      </div>
      {!activeHistory && inlineEditing.activeTarget && documentSession && <InlineMarkdownEditor target={inlineEditing.activeTarget} source={documentSession.source} labels={{ sourceLabel: editorT.inlineSourceLabel, apply: editorT.apply, cancel: editorT.cancel }} onApply={inlineEditing.apply} onCancel={inlineEditing.cancel} />}
    </main>
  );
}
