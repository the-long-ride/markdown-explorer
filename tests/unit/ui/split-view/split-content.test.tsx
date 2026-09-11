import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  return {
    ...initialState,
    settings: { ...initialState.settings, language: 'en' },
    contentTabs: [tab],
    documentSessions: { [documentSessionKey('/docs/a.md')]: session },
    splitView: {
      ...createSplitViewState('/docs/a.md'),
      enabled: true,
      activePane: 'primary' as const,
      primary: { ...createSplitViewState('/docs/a.md').primary, filePath: '/docs/a.md', mode: 'plain' as const, scrollTop: 100 },
      secondary: { ...createSplitViewState('/docs/a.md').secondary, filePath: '/docs/a.md', mode: 'rendered' as const, scrollTop: 450 },
    },
  };
}

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

    expect(screen.getByRole('textbox', { name: /markdown source/i })).toHaveValue('# edited');
    expect(screen.getByRole('region', { name: /secondary document/i })).toHaveTextContent('edited');
  });

  it('routes pane mode and scroll actions independently', () => {
    const onModeChange = vi.fn();
    const onScrollChange = vi.fn();
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={onModeChange}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={onScrollChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /primary.*rendered/i }));
    expect(onModeChange).toHaveBeenCalledWith('primary', 'rendered');

    const secondaryScroll = screen.getByTestId('split-pane-scroll-secondary');
    Object.defineProperty(secondaryScroll, 'scrollTop', { configurable: true, value: 512 });
    fireEvent.scroll(secondaryScroll);
    expect(onScrollChange).toHaveBeenCalledWith('secondary', 512);
  });
});
