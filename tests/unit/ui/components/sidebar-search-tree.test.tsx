import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { SearchResultFileView, SearchResultFolderView, renderHighlightedExcerpt } from '../../../../ui/src/components/Sidebar/sidebarSearchTree';
import { buildSearchResultTree } from '../../../../ui/src/components/Sidebar/sidebarSearchResultTree';

const context = vi.hoisted(() => ({ state: {} as AppState, navigate: vi.fn() }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => context }));

const path = '/docs/ref/guide.md';
const result = {
  fsPath: path, fileName: 'guide.md', title: 'Guide', relativePath: 'ref/guide.md',
  excerpt: 'Counting Guide entries', lineNumber: 14, matchIndex: 9, matchOrdinal: 2,
};
const tree = buildSearchResultTree(new Map([[path, [result, { ...result, lineNumber: undefined, excerpt: undefined }]]]))!;
const file = tree.children[0].files[0];

function fileProps() {
  return { file, query: 'Guide', matchCase: true, collapsedPaths: new Set<string>(), togglePath: vi.fn() };
}
function state(overrides: Partial<AppState> = {}) {
  return { ...initialState, settings: { ...initialState.settings, showTitle: true }, currentFile: path, contentHtml: '<p>Live</p>', isLoading: false, ...overrides };
}

describe('sidebar search result tree', () => {
  it('highlights Unicode-folded matches without losing their original source spelling', () => {
    const { container, rerender } = render(<p>{renderHighlightedExcerpt('A Straße and STRASSE.', 'strasse')}</p>);
    expect([...container.querySelectorAll('strong')].map((mark) => mark.textContent)).toEqual(['Straße', 'STRASSE']);
    expect(container).toHaveTextContent('A Straße and STRASSE.');
    rerender(<p>{renderHighlightedExcerpt('lower LOWER lower', '  LOWER ', true)}</p>);
    expect([...container.querySelectorAll('strong')].map((mark) => mark.textContent)).toEqual(['LOWER']);
    rerender(<p>{renderHighlightedExcerpt('excerpt', '   ')}</p>);
    expect(container.querySelector('strong')).toBeNull();
    expect(renderHighlightedExcerpt('excerpt', 'Absent', true)).toBe('excerpt');
    expect(renderHighlightedExcerpt('excerpt', 'Absent')).toBe('excerpt');
  });

  it('toggles nested folders and files with pointer and keyboard and hides collapsed results', () => {
    context.state = state({ settings: { ...initialState.settings, showTitle: false } });
    const props = { ...fileProps(), node: tree };
    const { rerender } = render(<SearchResultFolderView {...props} />);
    const folder = screen.getByRole('button', { name: 'ref' });
    const fileHeader = screen.getByRole('button', { name: /guide\.md/ });
    fireEvent.keyDown(folder, { key: 'Escape' });
    fireEvent.keyDown(fileHeader, { key: 'Escape' });
    expect(props.togglePath).not.toHaveBeenCalled();
    fireEvent.keyDown(folder, { key: ' ' });
    fireEvent.click(folder);
    fireEvent.keyDown(fileHeader, { key: 'Enter' });
    fireEvent.click(fileHeader);
    expect(props.togglePath.mock.calls.flat()).toEqual(['ref', 'ref', path, path]);
    expect(screen.getByText('14')).toBeInTheDocument();
    rerender(<SearchResultFolderView {...props} collapsedPaths={new Set([path])} />);
    expect(screen.queryByText('14')).not.toBeInTheDocument();
    rerender(<SearchResultFolderView {...props} collapsedPaths={new Set(['ref'])} />);
    expect(screen.queryByRole('button', { name: /guide\.md/ })).not.toBeInTheDocument();
  });

  it('uses a custom match opener without sending any document navigation', () => {
    context.state = state();
    const onOpenResult = vi.fn();
    render(<SearchResultFileView {...fileProps()} onOpenResult={onOpenResult} />);
    const match = screen.getByRole('button', { name: /Counting Guide entries/ });
    fireEvent.keyDown(match, { key: ' ' });
    expect(onOpenResult).not.toHaveBeenCalled();
    fireEvent.keyDown(match, { key: 'Enter' });
    expect(onOpenResult).toHaveBeenCalledExactlyOnceWith(result);
    expect(context.navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['live', {}, false],
    ['loading', { isLoading: true }, true],
    ['stale', { staleContentFilePath: path }, true],
    ['failed', { notFoundHref: path }, true],
    ['not rendered', { contentHtml: '' }, true],
    ['no active file', { currentFile: null }, true],
    ['another document', { currentFile: '/docs/other.md' }, true],
    ['active split belongs to another file', { splitView: { ...initialState.splitView, enabled: true } }, true],
  ] as const)('dispatches a jump and navigates only when necessary: %s', (_label, overrides, navigate) => {
    context.state = state(overrides);
    const jump = vi.fn();
    window.addEventListener('search-jump', jump, { once: true });
    try {
      render(<SearchResultFileView {...fileProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Counting Guide entries/ }));
      expect(jump).toHaveBeenCalledWith(expect.objectContaining({
        detail: { filePath: path, query: 'Guide', matchOrdinal: 2, matchIndex: 9, lineNumber: 14, excerpt: result.excerpt, matchCase: true },
      }));
      if (navigate) expect(context.navigate).toHaveBeenCalledExactlyOnceWith(path);
      else expect(context.navigate).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('search-jump', jump);
    }
  });
});
