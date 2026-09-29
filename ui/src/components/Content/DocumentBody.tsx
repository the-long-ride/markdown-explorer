import { lazy, memo, Suspense, type ReactNode } from 'react';
import type { Translations } from '../../contexts/translations';
import type { DocumentRootId } from '../../document/activeDocumentRoot';
import type { HtmlLocalFirstPolicyReport } from '../../markdown/htmlLocalFirstPreview';
import type { TocEntry } from '../../types';
import { AlertTriangleIcon } from '../shared/icons';
import { splitLeadingHtmlComments } from './contentUtils';
import type { PreviewNotice } from './documentPreviewNotice';
import { HtmlDocumentView } from './HtmlDocumentView';
import { MarkdownSourceEditor } from './MarkdownSourceEditor';

const TableOfContents = lazy(() => import('../TOC/TableOfContents').then((module) => ({ default: module.TableOfContents })));
const HtmlContent = memo(function HtmlContent({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: html }} />; });

export interface DocumentBodyHtml {
  isHtmlDocument: boolean;
  sourceText: string | null;
  markdownHtml: string;
  previewEnabled: boolean;
  allowUpstreamResources?: boolean;
  error: string | null;
}

export interface DocumentBodyPlainSession {
  source: string;
  saving: boolean;
  plainSourceLabel: string;
  dirty?: boolean;
}

export interface DocumentBodyProps {
  rootId: DocumentRootId;
  filePath: string;
  relativePath: string;
  language: string;
  translations: Translations;
  contentHtml: string;
  frontmatterEntries: Array<[string, string]>;
  toc: readonly TocEntry[];
  tocCollapsed: boolean;
  stale: boolean;
  previewNotice: PreviewNotice | null;
  html: DocumentBodyHtml;
  plainSession: DocumentBodyPlainSession | null;
  onRefresh: () => void;
  onHtmlPolicyReport?: (report: HtmlLocalFirstPolicyReport) => void;
  onSourceChange: (source: string) => void;
  onSave: () => void;
  onPreview: () => void;
}

// Rendered body shared by the main document view and every split pane:
// stale notice, HTML document view, plain source editor, or the rendered
// markdown with preview notice, compact TOC, leading comments and frontmatter.
function DocumentBodyImpl({
  rootId, filePath, relativePath, language, translations: t, contentHtml, frontmatterEntries, toc, tocCollapsed,
  stale, previewNotice, html, plainSession, onRefresh, onHtmlPolicyReport, onSourceChange, onSave, onPreview,
}: DocumentBodyProps): ReactNode {
  const previewCopy = t.documentPreview;
  const parts = splitLeadingHtmlComments(contentHtml || '');
  return (
    <>
      {stale && <div className="document-preview-notice current-file-change-notice" role="status"><AlertTriangleIcon size={16} /><div className="document-preview-notice__body current-file-change-notice__body"><span>{previewCopy.currentFileChangedOnDisk}</span><button type="button" className="btn current-file-change-notice__button" onClick={onRefresh}>{previewCopy.refreshCurrentFile}</button><span>{previewCopy.currentFileChangedSuffix}</span></div></div>}
      {html.isHtmlDocument && html.sourceText !== null ? <HtmlDocumentView filePath={filePath} htmlSource={html.sourceText} markdownHtml={html.markdownHtml} previewEnabled={html.previewEnabled} title={relativePath || filePath} conversionError={html.error} allowUpstreamResources={html.allowUpstreamResources} onPolicyReport={onHtmlPolicyReport} />
        : plainSession ? <MarkdownSourceEditor value={plainSession.source} disabled={plainSession.saving} ariaLabel={plainSession.plainSourceLabel} language={language || 'en'} dirty={plainSession.dirty} onChange={onSourceChange} onSave={onSave} onPreview={onPreview} />
        : <>
          {previewNotice && <div className={`document-preview-notice document-preview-notice--${previewNotice.kind}`} role="note"><AlertTriangleIcon size={16} /><div className="document-preview-notice__body"><div className="document-preview-notice__title">{previewNotice.title}</div><div className="document-preview-notice__text">{previewNotice.warning}</div>{previewNotice.meta && <div className="document-preview-notice__meta">{previewNotice.meta}</div>}</div></div>}
          {toc.length > 0 && !tocCollapsed && <Suspense fallback={null}><TableOfContents variant="compact" entries={rootId === 'main' ? undefined : toc} rootId={rootId === 'main' ? undefined : rootId} /></Suspense>}
          {parts.leadingCommentsHtml && <HtmlContent html={parts.leadingCommentsHtml} />}
          {frontmatterEntries.length > 0 && <details className="mdn-frontmatter" open aria-label={t.ui.documentProperties}><summary className="mdn-frontmatter-summary"><span>{t.ui.properties}</span><span className="mdn-frontmatter-count">{frontmatterEntries.length} {frontmatterEntries.length === 1 ? t.ui.propertySingular : t.ui.propertyPlural}</span></summary><div className="mdn-frontmatter-grid">{frontmatterEntries.map(([key, value]) => <div className="mdn-frontmatter-field" key={key}><span className="mdn-frontmatter-key">{key}</span><span className={`mdn-frontmatter-value${value ? '' : ' is-empty'}`}>{value || ' '}</span></div>)}</div></details>}
          <HtmlContent html={parts.bodyHtml} />
        </>}
    </>
  );
}

// Memoised: a pane re-render with unchanged document inputs keeps the body.
export const DocumentBody = memo(DocumentBodyImpl);

export function frontmatterEntriesOf(frontmatter: Record<string, unknown> | null | undefined): Array<[string, string]> {
  return Object.entries(frontmatter ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)]);
}
