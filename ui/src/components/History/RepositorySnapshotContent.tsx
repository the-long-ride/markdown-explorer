import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../contexts/AppStateContext';
import { renderMarkdownClientSide } from '../../contexts/contentTabState';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { usePlatform } from '../../contexts/PlatformContext';
import { useRepositorySnapshot } from '../../contexts/RepositorySnapshotContext';
import { getTranslations } from '../../contexts/translations';
import { useDocumentRootRegistration } from '../../document/useDocumentRootRegistration';
import {
  resolveSnapshotDocumentFilePath,
  resolveSnapshotLinkTarget,
  stripSnapshotInlineNavHandlers,
} from '../../history/snapshotLinkResolution';
import { useSnapshotSearchJump } from '../../utils/snapshotSearchJump';
import { splitLeadingHtmlComments } from '../Content/contentUtils';
import { frontmatterEntriesOf } from '../Content/DocumentBody';
import { setHeadingSectionExpanded } from '../Content/enhancements/headingSectionState';
import { useDocumentInteractions } from '../Content/useDocumentInteractions';
import { showActionNotice, useDocumentOverlays } from '../Content/useDocumentOverlays';
import { createMediaGallery } from '../Modal/mediaGallery';
import '../../styles/global/global-history-diff.css';

const TableOfContents = lazy(() =>
  import('../TOC/TableOfContents').then((module) => ({ default: module.TableOfContents })),
);

const SnapshotHtmlContent = memo(function SnapshotHtmlContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatSnapshotCommitDate(value: string | undefined): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const month = SHORT_MONTHS[Number(dateOnly[2]) - 1];
    return month ? `${Number(dateOnly[3])} ${month} ${dateOnly[1]}` : trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return `${parsed.getDate()} ${SHORT_MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function scrollToFragmentInBody(body: HTMLElement | null, fragment: string): boolean {
  if (!body || !fragment) return false;
  const target = body.querySelector<HTMLElement>(`[id="${CSS.escape(fragment)}"]`);
  if (!target) return false;
  let section = target.closest<HTMLElement>('.mdn-section');
  while (section) {
    setHeadingSectionExpanded(section, true);
    section = section.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
  }
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  return true;
}

export function RepositorySnapshotContent() {
  const { state: appState, setSidebarActiveTab, setSidebarCollapsed } = useAppState();
  const bridge = usePlatform();
  const {
    state,
    commits,
    repositoryView,
    activeRendered,
    openSnapshotFile,
    returnToHead,
  } = useRepositorySnapshot();
  const t = getHistoryTranslations(appState.settings.language);
  const uiT = getTranslations(appState.settings.language || 'en');
  const snapshot = state.activeFile;
  const revisionOid = repositoryView.mode === 'revision' ? repositoryView.oid : null;
  const activeCommit = useMemo(
    () => (revisionOid ? (commits ?? []).find((commit) => commit.oid === revisionOid) ?? null : null),
    [commits, revisionOid],
  );
  const handleExploreCommitFiles = useCallback(() => {
    if (appState.sidebarCollapsed) setSidebarCollapsed?.(false);
    setSidebarActiveTab?.('files');
  }, [appState.sidebarCollapsed, setSidebarActiveTab, setSidebarCollapsed]);
  const isMarkdown = Boolean(snapshot && /\.mdx?$/i.test(snapshot.path));

  const fallbackRendered = useMemo(() => {
    if (activeRendered !== undefined || !snapshot || !isMarkdown) return null;
    return renderMarkdownClientSide(
      snapshot.source,
      snapshot.path,
      /\.mdx$/i.test(snapshot.path),
      {
        defaultHtmlPreview: appState.settings.defaultHtmlPreview,
        defaultHtmlCodeBlockPreview: appState.settings.defaultHtmlCodeBlockPreview,
        defaultCsvPreview: appState.settings.defaultCsvPreview,
        language: appState.settings.language,
      },
    );
  }, [
    activeRendered,
    appState.settings.defaultCsvPreview,
    appState.settings.defaultHtmlCodeBlockPreview,
    appState.settings.defaultHtmlPreview,
    appState.settings.language,
    isMarkdown,
    snapshot,
  ]);
  const rendered = activeRendered ?? fallbackRendered;

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLElement>(null);
  const pendingFragmentRef = useRef<string | null>(null);
  const lastDocumentSignatureRef = useRef<string>('');
  const renderVersionRef = useRef(0);

  const sanitizedHtml = useMemo(
    () => (rendered ? stripSnapshotInlineNavHandlers(rendered.html) : ''),
    [rendered],
  );
  const htmlParts = useMemo(() => splitLeadingHtmlComments(sanitizedHtml), [sanitizedHtml]);
  const frontmatterEntries = useMemo(
    () => frontmatterEntriesOf(rendered?.frontmatter),
    [rendered?.frontmatter],
  );

  const snapshotDocumentFilePath = snapshot
    ? resolveSnapshotDocumentFilePath(appState.workspacePath, snapshot.path)
    : null;
  const snapshotDocumentKey = revisionOid && snapshot ? `${revisionOid}:${snapshot.path}` : '';
  const documentSignature = `${snapshotDocumentKey}:${sanitizedHtml.length}:${rendered ? 'md' : 'raw'}`;
  if (lastDocumentSignatureRef.current !== documentSignature) {
    lastDocumentSignatureRef.current = documentSignature;
    renderVersionRef.current += 1;
  }
  const renderVersion = renderVersionRef.current;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.querySelectorAll('a[data-mdn-target][onclick]').forEach((anchor) => {
      anchor.removeAttribute('onclick');
    });
  }, [renderVersion]);

  useEffect(() => {
    const pendingFragment = pendingFragmentRef.current;
    if (pendingFragment && isMarkdown && rendered) {
      pendingFragmentRef.current = null;
      scrollToFragmentInBody(bodyRef.current, pendingFragment);
      return;
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [snapshot?.path, revisionOid, isMarkdown, rendered]);

  const handleImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? bodyRef.current ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) {
      window.dispatchEvent(new CustomEvent('markdown-explorer-open-media-modal', { detail: gallery }));
    }
  }, []);

  const handleNavigate = useCallback(
    (rawHref: string, options?: { isWikiLink?: boolean }) => {
      if (!snapshot) return;
      const target = resolveSnapshotLinkTarget(rawHref, snapshot.path, state.files, options);
      if (!target) return;
      if (target.kind === 'fragment') {
        scrollToFragmentInBody(bodyRef.current, target.fragment);
        return;
      }
      if (target.kind === 'external') {
        bridge.postMessage({ command: 'openExternal', url: target.url });
        return;
      }
      if (target.kind === 'snapshot-file') {
        if (target.path === snapshot.path) {
          if (target.fragment) {
            scrollToFragmentInBody(bodyRef.current, target.fragment);
          } else if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
          return;
        }
        pendingFragmentRef.current = target.fragment;
        void openSnapshotFile(target.path);
        return;
      }
      showActionNotice(`${uiT.ui.fileNotFound}: ${target.targetPath}`, 'error');
    },
    [bridge, openSnapshotFile, snapshot, state.files, uiT.ui.fileNotFound],
  );

  // Intercept wiki links and external links inside the snapshot body before
  // document-level handlers can route them to the live workspace.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !snapshot || !isMarkdown || !rendered) return;
    const handleSpecialLinkClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const wikiLink = target.closest<HTMLElement>('.mdn-wiki-link[data-mdn-wiki-target]');
      if (wikiLink && body.contains(wikiLink)) {
        event.preventDefault();
        event.stopPropagation();
        const wikiTarget = wikiLink.dataset.mdnWikiTarget ?? '';
        const fragment = wikiLink.dataset.mdnWikiFragment;
        handleNavigate(fragment ? `${wikiTarget}#${fragment}` : wikiTarget, { isWikiLink: true });
        return;
      }
      const externalAnchor = target.closest<HTMLAnchorElement>('a[href]');
      if (externalAnchor && body.contains(externalAnchor) && !externalAnchor.dataset.mdnTarget) {
        const href = (externalAnchor.getAttribute('href') ?? '').trim();
        if (/^https?:/i.test(href)) {
          event.preventDefault();
          event.stopPropagation();
          bridge.postMessage({ command: 'openExternal', url: externalAnchor.href || href });
        }
      }
    };
    body.addEventListener('click', handleSpecialLinkClick, true);
    return () => body.removeEventListener('click', handleSpecialLinkClick, true);
  }, [bridge, handleNavigate, isMarkdown, rendered, snapshot]);

  useDocumentRootRegistration({
    id: 'snapshot',
    bodyRef,
    scrollRef,
    filePath: snapshotDocumentFilePath,
    markdownSource: snapshot?.source ?? null,
    renderVersion,
    active: Boolean(revisionOid && snapshot && isMarkdown && rendered),
  });

  const documentOverlays = useDocumentOverlays({
    state: appState,
    bridge,
    bodyRef,
    onImageClick: handleImageClick,
    disableBookmarks: true,
    disableScope: true,
    document: {
      filePath: snapshotDocumentFilePath,
      relativePath: snapshot?.path ?? '',
      contentHtml: sanitizedHtml,
      renderVersion,
      markdownSource: snapshot?.source ?? null,
      sourceDocumentText: null,
      isFullHtmlPreview: false,
    },
  });

  useDocumentInteractions({
    state: appState,
    document: {
      rootId: 'snapshot',
      filePath: snapshotDocumentFilePath,
      renderVersion,
      disabled: !revisionOid || !snapshot || !isMarkdown || !rendered,
      persistReadingProgress: false,
    },
    bodyRef,
    scrollRef,
    bridge,
    previewLabels: uiT.previewActions,
    onImageClick: handleImageClick,
    navigate: handleNavigate,
    onOpenHtmlModal: documentOverlays.onOpenHtmlModal,
    onOpenLinkMenu: documentOverlays.onOpenLinkMenu,
    onActionError: documentOverlays.onActionError,
  });

  useSnapshotSearchJump({
    oid: revisionOid,
    activePath: snapshot?.path ?? null,
    source: snapshot?.source ?? null,
    containerRef: scrollRef,
    renderKey: rendered?.html ?? snapshot?.source ?? null,
  });

  if (!revisionOid) return null;

  return (
    <main className="content repository-snapshot-content" data-testid="repository-snapshot-content">
      <header className="repository-snapshot-content__header">
        <div className="repository-snapshot-content__identity">
          <span className="repository-snapshot-content__readonly">{t.snapshotReadOnly}</span>
          {snapshot && <strong data-hover-tooltip={snapshot.path}>{snapshot.path}</strong>}
          <code>{revisionOid.slice(0, 7)}</code>
        </div>
        <button type="button" className="btn" onClick={returnToHead}>{t.backToHead}</button>
      </header>
      <div ref={scrollRef} className="content__scroll repository-snapshot-content__scroll">
        {!snapshot ? (
          <div className="repository-snapshot-content__empty" data-testid="repository-snapshot-commit-panel">
            <section className="repository-snapshot-content__commit-card" aria-label={t.snapshotViewingCommit}>
              <div className="repository-snapshot-content__commit-eyebrow">
                <span className="repository-snapshot-content__readonly">{t.snapshotViewingCommit}</span>
                <code className="repository-snapshot-content__commit-sha" data-hover-tooltip={revisionOid}>
                  {activeCommit?.shortOid || revisionOid.slice(0, 7)}
                </code>
              </div>
              <h2 className="repository-snapshot-content__commit-subject">
                {activeCommit?.subject?.trim() || t.noCommitMessage}
              </h2>
              {(() => {
                const author = activeCommit?.author?.trim() || '';
                const date = formatSnapshotCommitDate(activeCommit?.authoredAt);
                const meta = author && date
                  ? t.authoredByAt.replace('{author}', author).replace('{date}', date)
                  : author
                    ? t.authoredBy.replace('{author}', author)
                    : date
                      ? t.authoredOn.replace('{date}', date)
                      : '';
                return meta ? <p className="repository-snapshot-content__commit-meta">{meta}</p> : null;
              })()}
              <div className="repository-snapshot-content__commit-actions">
                <button type="button" className="btn btn--primary" onClick={handleExploreCommitFiles}>
                  {t.exploreCommitFiles}
                </button>
                <button type="button" className="btn" onClick={returnToHead}>
                  {t.backToHead}
                </button>
              </div>
            </section>
          </div>
        ) : isMarkdown && rendered ? (
          <article
            ref={bodyRef}
            className="mdn-body repository-snapshot-content__body"
            data-document-root="snapshot"
            data-file-path={snapshotDocumentFilePath || undefined}
            data-mdn-source-document-path={snapshot.path}
            aria-live="polite"
          >
            {rendered.toc.length > 0 && !appState.tocCollapsed && (
              <Suspense fallback={null}>
                <TableOfContents
                  variant="compact"
                  entries={rendered.toc}
                  rootId="snapshot"
                  documentKey={snapshotDocumentKey}
                />
              </Suspense>
            )}
            {htmlParts.leadingCommentsHtml && <SnapshotHtmlContent html={htmlParts.leadingCommentsHtml} />}
            {frontmatterEntries.length > 0 && (
              <details className="mdn-frontmatter" open aria-label={uiT.ui.documentProperties}>
                <summary className="mdn-frontmatter-summary">
                  <span>{uiT.ui.properties}</span>
                  <span className="mdn-frontmatter-count">
                    {frontmatterEntries.length}{' '}
                    {frontmatterEntries.length === 1 ? uiT.ui.propertySingular : uiT.ui.propertyPlural}
                  </span>
                </summary>
                <div className="mdn-frontmatter-grid">
                  {frontmatterEntries.map(([key, value]) => (
                    <div className="mdn-frontmatter-field" key={key}>
                      <span className="mdn-frontmatter-key">{key}</span>
                      <span className={`mdn-frontmatter-value${value ? '' : ' is-empty'}`}>{value || '\u00A0'}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <SnapshotHtmlContent html={htmlParts.bodyHtml} />
          </article>
        ) : (
          <pre className="repository-snapshot-content__source"><code>{snapshot.source}</code></pre>
        )}
      </div>
      {typeof document !== 'undefined'
        ? createPortal(documentOverlays.overlays, document.body)
        : documentOverlays.overlays}
    </main>
  );
}
