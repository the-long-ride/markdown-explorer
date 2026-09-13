import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { createEditableDocumentSession, documentSessionKey } from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';

const renderCounts = vi.hoisted(() => new Map<string, number>());

vi.mock('../../../../ui/src/components/Content/DocumentSurface', () => ({
  DocumentSurface: ({ filePath, mode, source }: { filePath: string; mode: string; source: string }) => {
    const key = `${filePath}:${mode}`;
    renderCounts.set(key, (renderCounts.get(key) ?? 0) + 1);
    return <div data-testid={`surface-${key}`}>{source}</div>;
  },
}));

import { SplitContentView } from '../../../../ui/src/components/Content/SplitContent';

const callbacks = {
  onActivatePane: vi.fn(),
  onRatioChange: vi.fn(),
  onCloseSplit: vi.fn(),
  onModeChange: vi.fn(),
  onSourceChange: vi.fn(),
  onSave: vi.fn(),
  onScrollChange: vi.fn(),
};

function tab(filePath: string, source: string) {
  const fileName = filePath.split('/').pop()!;
  return {
    filePath,
    relativePath: fileName,
    fileName,
    title: fileName.replace(/\.md$/, ''),
    contentHtml: `<p>${source}</p>`,
    markdownSource: source,
    sourceDocumentText: source,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    documentWrite: { supported: true, revision: '1:3' },
  } as const;
}

function stateForDifferentDocuments() {
  return {
    ...initialState,
    settings: { ...initialState.settings, language: 'en', markdownEditingEnabled: true, fileTabs: true },
    contentTabs: [tab('/docs/a.md', '# A'), tab('/docs/b.md', '# B')],
    documentSessions: {
      [documentSessionKey('/docs/a.md')]: createEditableDocumentSession('/docs/a.md', '# A', '1:3'),
      [documentSessionKey('/docs/b.md')]: createEditableDocumentSession('/docs/b.md', '# B', '1:3'),
    },
    documentRenderRevisions: {
      [documentSessionKey('/docs/a.md')]: 1,
      [documentSessionKey('/docs/b.md')]: 1,
    },
    splitView: {
      ...createSplitViewState('/docs/a.md'),
      enabled: true,
      activePane: 'primary' as const,
      primary: { ...createSplitViewState('/docs/a.md').primary, filePath: '/docs/a.md', mode: 'plain' as const },
      secondary: { ...createSplitViewState('/docs/b.md').secondary, filePath: '/docs/b.md', mode: 'rendered' as const },
    },
  };
}

function stateForSameDocument() {
  const session = createEditableDocumentSession('/docs/a.md', '# A', '1:3');
  return {
    ...initialState,
    settings: { ...initialState.settings, language: 'en', markdownEditingEnabled: true, fileTabs: true },
    contentTabs: [tab('/docs/a.md', '# A')],
    documentSessions: { [documentSessionKey('/docs/a.md')]: session },
    documentRenderRevisions: { [documentSessionKey('/docs/a.md')]: 1 },
    splitView: {
      ...createSplitViewState('/docs/a.md'),
      enabled: true,
      activePane: 'primary' as const,
      primary: { ...createSplitViewState('/docs/a.md').primary, filePath: '/docs/a.md', mode: 'plain' as const },
      secondary: { ...createSplitViewState('/docs/a.md').secondary, filePath: '/docs/a.md', mode: 'rendered' as const },
    },
  };
}

describe('split render isolation', () => {
  beforeEach(() => renderCounts.clear());

  it('does not rerender the opposite document body for pane-local source, scroll, or activation updates', () => {
    const state = stateForDifferentDocuments();
    const view = render(<SplitContentView state={state} {...callbacks} />);
    expect(renderCounts.get('/docs/a.md:plain')).toBe(1);
    expect(renderCounts.get('/docs/b.md:rendered')).toBe(1);

    const editedSession = { ...state.documentSessions[documentSessionKey('/docs/a.md')], source: '# A edited' };
    const editedState = {
      ...state,
      contentTabs: [tab('/docs/a.md', '# A edited'), state.contentTabs[1]],
      documentSessions: { ...state.documentSessions, [documentSessionKey('/docs/a.md')]: editedSession },
      documentRenderRevisions: { ...state.documentRenderRevisions, [documentSessionKey('/docs/a.md')]: 2 },
    };
    view.rerender(<SplitContentView state={editedState} {...callbacks} />);
    expect(renderCounts.get('/docs/a.md:plain')).toBe(2);
    expect(renderCounts.get('/docs/b.md:rendered')).toBe(1);

    const primaryScrolled = {
      ...editedState,
      splitView: { ...editedState.splitView, primary: { ...editedState.splitView.primary, scrollTop: 120 } },
    };
    view.rerender(<SplitContentView state={primaryScrolled} {...callbacks} />);
    expect(renderCounts.get('/docs/b.md:rendered')).toBe(1);

    const secondaryActive = { ...primaryScrolled, splitView: { ...primaryScrolled.splitView, activePane: 'secondary' as const } };
    view.rerender(<SplitContentView state={secondaryActive} {...callbacks} />);
    expect(renderCounts.get('/docs/a.md:plain')).toBe(3);

    const secondaryScrolled = {
      ...secondaryActive,
      splitView: { ...secondaryActive.splitView, secondary: { ...secondaryActive.splitView.secondary, scrollTop: 220 } },
    };
    view.rerender(<SplitContentView state={secondaryScrolled} {...callbacks} />);
    expect(renderCounts.get('/docs/a.md:plain')).toBe(3);
  });

  it('debounces the rendered mirror when both panes show the actively edited document', async () => {
    vi.useFakeTimers();
    try {
      const state = stateForSameDocument();
      const view = render(<SplitContentView state={state} {...callbacks} />);
      expect(renderCounts.get('/docs/a.md:plain')).toBe(1);
      expect(renderCounts.get('/docs/a.md:rendered')).toBe(1);

      const editedSession = { ...state.documentSessions[documentSessionKey('/docs/a.md')], source: '# A edited' };
      const editedState = {
        ...state,
        contentTabs: [tab('/docs/a.md', '# A edited')],
        documentSessions: { [documentSessionKey('/docs/a.md')]: editedSession },
        documentRenderRevisions: { [documentSessionKey('/docs/a.md')]: 2 },
      };
      view.rerender(<SplitContentView state={editedState} {...callbacks} />);
      expect(renderCounts.get('/docs/a.md:plain')).toBe(2);
      expect(renderCounts.get('/docs/a.md:rendered')).toBe(1);

      await act(async () => { vi.advanceTimersByTime(149); });
      expect(renderCounts.get('/docs/a.md:rendered')).toBe(1);
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(renderCounts.get('/docs/a.md:rendered')).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
