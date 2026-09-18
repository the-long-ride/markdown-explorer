import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { createEditableDocumentSession, documentSessionKey } from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';
import { SplitContentView } from '../../../../ui/src/components/Content/SplitContent';

const tab = {
  filePath: '/docs/a.md',
  relativePath: 'a.md',
  fileName: 'a.md',
  title: 'A',
  contentHtml: '<h1>edited</h1>',
  markdownSource: '# edited',
  sourceDocumentText: '# A',
  frontmatter: {},
  toc: [],
  previewInfo: null,
  documentWrite: { supported: true, revision: '1:3' },
} as const;

function fixtureState() {
  const session = { ...createEditableDocumentSession('/docs/a.md', '# A', '1:3'), source: '# edited' };
  const split = createSplitViewState('/docs/a.md');
  return {
    ...initialState,
    settings: { ...initialState.settings, language: 'en', markdownEditingEnabled: true, fileTabs: true },
    contentTabs: [tab],
    documentSessions: { [documentSessionKey('/docs/a.md')]: session },
    splitView: {
      ...split,
      enabled: true,
      activePane: 'primary' as const,
      primary: { ...split.primary, filePath: '/docs/a.md', tabs: ['/docs/a.md'], activeTabPath: '/docs/a.md', mode: 'plain' as const, scrollTop: 100 },
      secondary: { ...split.secondary, filePath: '/docs/a.md', tabs: ['/docs/a.md'], activeTabPath: '/docs/a.md', mode: 'rendered' as const, scrollTop: 450 },
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SplitContentView', () => {
  it('renders independent modes for one shared source', () => {
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: /markdown source/i })).toHaveTextContent('# edited');
    expect(screen.getByRole('region', { name: /secondary document/i })).toHaveTextContent('edited');
  });

  it('does not dispatch global scroll state on every scroll event', () => {
    vi.useFakeTimers();
    const onScrollChange = vi.fn();
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={onScrollChange}
      />,
    );

    const secondaryScroll = screen.getByTestId('split-pane-scroll-secondary');
    Object.defineProperty(secondaryScroll, 'scrollTop', { configurable: true, writable: true, value: 512 });
    fireEvent.scroll(secondaryScroll);
    secondaryScroll.scrollTop = 640;
    fireEvent.scroll(secondaryScroll);
    expect(onScrollChange).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(250); });
    expect(onScrollChange).toHaveBeenCalledTimes(1);
    expect(onScrollChange).toHaveBeenCalledWith('secondary', 640);
  });

  it('renders a separate document-tab strip for each pane when file tabs are enabled', () => {
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('tablist')).toHaveLength(2);
    expect(screen.getAllByRole('tab', { name: 'A' })).toHaveLength(2);
  });
});
