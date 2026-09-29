import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';
import { ENHANCEMENTS_SETTLED_EVENT } from '../../../../ui/src/components/Content/scheduleContentEnhancements';

vi.mock('../../../../ui/src/components/Content/SplitPaneDocument', () => ({
  SplitPaneDocument: ({ projection: { filePath } }: { projection: { filePath: string } }) => (
    <div className="document-surface" data-testid={`surface-${filePath}`}>body</div>
  ),
}));

import { SplitContentView } from '../../../../ui/src/components/Content/SplitContent';

const callbacks = {
  onActivatePane: vi.fn(), onRatioChange: vi.fn(), onCloseSplit: vi.fn(), onModeChange: vi.fn(),
  onSourceChange: vi.fn(), onSave: vi.fn(), onScrollChange: vi.fn(),
};

function tab(filePath: string) {
  const fileName = filePath.split('/').pop()!;
  return { filePath, relativePath: fileName, fileName, title: fileName, contentHtml: '<p>x</p>', markdownSource: 'x', sourceDocumentText: 'x', frontmatter: {}, toc: [], previewInfo: null } as const;
}

function state() {
  const base = createSplitViewState('/docs/a.md');
  return {
    ...initialState,
    settings: { ...initialState.settings, language: 'en', fileTabs: true },
    contentTabs: [tab('/docs/a.md'), tab('/docs/b.md')],
    splitView: {
      ...base,
      enabled: true,
      activePane: 'primary' as const,
      primary: { ...base.primary, filePath: '/docs/a.md', mode: 'rendered' as const, scrollTop: 400 },
      secondary: { ...createSplitViewState('/docs/b.md').secondary, filePath: '/docs/b.md', mode: 'rendered' as const },
    },
  };
}

function settle(surface: Element) {
  surface.dispatchEvent(new CustomEvent(ENHANCEMENTS_SETTLED_EVENT, { bubbles: true }));
}

describe('split pane scroll restore', () => {
  it('re-applies the stored scroll after enhancements settle, until the user interacts', () => {
    const { getByTestId } = render(<SplitContentView state={state() as any} {...callbacks} />);
    const surface = getByTestId('surface-/docs/a.md');
    const scroll = surface.closest<HTMLElement>('.split-document-pane__scroll')!;
    scroll.scrollTop = 120; // content height changed under the first restore
    settle(surface);
    expect(scroll.scrollTop).toBe(400);

    scroll.dispatchEvent(new Event('wheel'));
    scroll.scrollTop = 50;
    settle(surface);
    expect(scroll.scrollTop).toBe(50);
  });
});
