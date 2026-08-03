import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState } from '../../contexts/appStateModel';
import { renderMarkdownClientSide } from '../../contexts/contentTabState';
import type { PlatformBridge } from '../../platform/bridge';
import { scrollToRenderedSearchMatchInRoot } from '../../utils/searchJump';
import { isCrossTabItem, resultKey, type SearchResultItem } from './searchOverlayModel';
import { scheduleContentEnhancements } from '../Content/scheduleContentEnhancements';
import { createHeadingSectionInteractions } from '../Content/headingSectionInteractions';
import type { HeadingSectionState } from '../Content/enhancements/headingSectionState';

interface SearchDocumentPreviewProps {
  bridge: PlatformBridge;
  item: SearchResultItem | null;
  query: string;
  matchCase: boolean;
  theme: AppState['theme'];
  settings: AppState['settings'];
  loadingLabel: string;
  errorLabel: string;
}

type PreviewState =
  | { status: 'idle'; key: string }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; markdownSource: string }
  | { status: 'error'; key: string };

function SearchDocumentPreviewInner({
  bridge,
  item,
  query,
  matchCase,
  theme,
  settings,
  loadingLabel,
  errorLabel,
}: SearchDocumentPreviewProps) {
  const previewRootRef = useRef<HTMLDivElement>(null);
  const mermaidRunIdRef = useRef(0);
  const headingStateMapRef = useRef(new Map<string, HeadingSectionState>());
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle', key: '' });
  const itemKey = item ? resultKey(item) : '';

  const itemRef = useRef<SearchResultItem | null>(item);
  itemRef.current = item;

  useEffect(() => {
    if (!itemKey) {
      setPreview({ status: 'idle', key: '' });
      return;
    }
    // Access item via ref so this effect only fires when itemKey actually changes,
    // not on every new object reference from a rebuilt results array.
    const currentItem = itemRef.current;
    if (!currentItem) return;

    const requestId = `search-preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let active = true;
    setPreview({ status: 'loading', key: itemKey });
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'searchPreviewResult' || message.requestId !== requestId) return;
      if (!active) return;
      setPreview(message.ok && typeof message.markdownSource === 'string'
        ? { status: 'ready', key: itemKey, markdownSource: message.markdownSource }
        : { status: 'error', key: itemKey });
    });

    bridge.postMessage({
      command: 'loadSearchPreview',
      requestId,
      filePath: currentItem.fsPath,
      tabId: isCrossTabItem(currentItem) ? currentItem.tabId : undefined,
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge, itemKey]);  // ← item intentionally omitted: access via itemRef above

  const renderedHtml = useMemo(() => {
    if (preview.status !== 'ready' || preview.key !== itemKey || !item) return '';
    return renderMarkdownClientSide(
      preview.markdownSource,
      item.fsPath,
      item.fileName.toLowerCase().endsWith('.mdx'),
      settings,
    ).html;
  }, [item, itemKey, preview, settings]);

  useEffect(() => {
    const body = previewRootRef.current;
    if (!body || preview.status !== 'ready' || preview.key !== itemKey || !renderedHtml) return;

    const stopEnhancements = scheduleContentEnhancements({
      body,
      state: { theme },
      scrollRef: { current: null },
      handleScroll: () => {},
      mermaidRunIdRef,
    });

    return () => {
      stopEnhancements();
    };
  }, [itemKey, preview.key, preview.status, renderedHtml, theme]);

  useEffect(() => {
    const body = previewRootRef.current;
    if (!body || preview.status !== 'ready' || preview.key !== itemKey || !renderedHtml) return;

    const headingInteractions = createHeadingSectionInteractions({
      body,
      currentFile: item?.fsPath,
      defaultExpanded: true,
      stateByFile: headingStateMapRef.current,
    });

    return () => {
      headingInteractions.dispose();
    };
  }, [item?.fsPath, itemKey, preview.key, preview.status, renderedHtml]);

  useEffect(() => {
    const body = previewRootRef.current;
    if (!body || preview.status !== 'ready' || preview.key !== itemKey) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const copyCodeBtn = target.closest('.mdn-copy-btn') as HTMLElement | null;
      if (copyCodeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const win = window as any;
        if (win.UI?.copyCode) win.UI.copyCode(copyCodeBtn);
        return;
      }

      const togglePreviewBtn = target.closest('.mdn-toggle-preview-btn') as HTMLElement | null;
      if (togglePreviewBtn) {
        e.preventDefault();
        e.stopPropagation();
        const win = window as any;
        if (win.UI?.toggleHtmlMode) win.UI.toggleHtmlMode(togglePreviewBtn);
        return;
      }

      const toggleCsvBtn = target.closest('.mdn-toggle-csv-btn') as HTMLElement | null;
      if (toggleCsvBtn) {
        e.preventDefault();
        e.stopPropagation();
        const win = window as any;
        if (win.UI?.toggleCsvMode) win.UI.toggleCsvMode(toggleCsvBtn);
        return;
      }

      const codeblockToggleBtn = target.closest('.mdn-codeblock-toggle-btn') as HTMLElement | null;
      if (codeblockToggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const win = window as any;
        if (win.UI?.toggleCodeCollapse) win.UI.toggleCodeCollapse(codeblockToggleBtn);
        return;
      }

      const selectBtn = target.closest('.mdn-table-view-select') as HTMLElement | null;
      if (selectBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdownEl = selectBtn.closest('.mdn-table-view-dropdown') as HTMLElement | null;
        if (dropdownEl && dropdownEl.id) {
          const tableId = dropdownEl.id.replace('-view-dropdown', '');
          const win = window as any;
          if (win.Table?.toggleViewDropdown) win.Table.toggleViewDropdown(tableId, e);
        }
        return;
      }

      const optionBtn = target.closest('.mdn-table-view-menu__option') as HTMLElement | null;
      if (optionBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdownEl = optionBtn.closest('.mdn-table-view-dropdown') as HTMLElement | null;
        const val = optionBtn.getAttribute('data-value');
        if (dropdownEl && dropdownEl.id && val) {
          const tableId = dropdownEl.id.replace('-view-dropdown', '');
          const win = window as any;
          if (win.Table?.switchView) win.Table.switchView(tableId, val);
          if (win.Table?.closeViewDropdown) win.Table.closeViewDropdown(tableId);
        }
        return;
      }

      const link = target.closest<HTMLAnchorElement>('.mdn-body a[href]');
      const href = link?.getAttribute('href') ?? '';
      if (link && href.startsWith('#') && href.length > 1) {
        e.preventDefault();
        const targetId = decodeURIComponent(href.slice(1));
        const targetEl = body.querySelector(`#${CSS.escape(targetId)}`) || document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    body.addEventListener('click', handleClick);
    return () => body.removeEventListener('click', handleClick);
  }, [itemKey, preview.key, preview.status]);

  useEffect(() => {
    if (!item || preview.status !== 'ready' || preview.key !== itemKey || !renderedHtml) return;
    const timer = window.setTimeout(() => {
      scrollToRenderedSearchMatchInRoot(
        previewRootRef.current,
        query,
        item.matchOrdinal,
        item.matchIndex,
        preview.markdownSource,
        matchCase,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [item, itemKey, matchCase, preview, query, renderedHtml]);

  if (!item) return null;
  if (preview.status === 'loading' || preview.key !== itemKey) {
    return <div className="search-overlay-preview__status"><div className="spinner" />{loadingLabel}</div>;
  }
  if (preview.status !== 'ready') {
    return <div className="search-overlay-preview__status">{errorLabel}</div>;
  }

  return (
    <div className="search-overlay-preview__scroll" data-search-scroll-container>
      <div
        ref={previewRootRef}
        className="mdn-body search-overlay-preview__document"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}

export const SearchDocumentPreview = memo(SearchDocumentPreviewInner);
