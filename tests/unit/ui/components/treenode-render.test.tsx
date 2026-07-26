import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileNode, FolderNodeView } from '../../../../ui/src/components/Sidebar/TreeNode';
import type { ScopeFocusTreeProps } from '../../../../ui/src/components/Sidebar/TreeNode';

const mockNavigate = vi.fn();
const mockUpdateSettings = vi.fn();

const createMockState = (overrides: Record<string, unknown> = {}) => ({
  currentFile: null,
  workspacePath: '/docs',
  appRuntime: 'vscode',
  hostPlatform: 'unknown',
  settings: { showTitle: true, language: 'en' },
  ...overrides,
});

let mockState: any = createMockState();

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState, navigate: mockNavigate, updateSettings: mockUpdateSettings }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  FolderIcon: () => <span>folder-icon</span>,
  FolderChevronIcon: () => <span>chevron-icon</span>,
  OpenFolderLocationIcon: () => <span>open-folder-icon</span>,
  RevealFileLocationIcon: () => <span>reveal-file-icon</span>,
  MoreVerticalIcon: () => <span>more-icon</span>,
}));

const baseFile = {
  fsPath: '/docs/readme.md',
  relativePath: 'readme.md',
  fileName: 'readme.md',
  title: 'Readme',
};

const defaultScopeFocus: ScopeFocusTreeProps = {
  editing: false,
  hideUnselected: false,
  selectedFilePaths: new Set(['/docs/readme.md']),
  onFileChange: vi.fn(),
  onFolderChange: vi.fn(),
};

describe('FileNode', () => {
  beforeEach(() => {
    mockState = createMockState();
    mockNavigate.mockClear();
  });

  it('renders file title when showTitle is true', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByText('Readme')).toBeInTheDocument();
  });

  it('renders file fileName when showTitle is false', () => {
    mockState.settings.showTitle = false;
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByText('readme.md')).toBeInTheDocument();
  });

  it('fires navigate on click', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    fireEvent.click(screen.getByRole('treeitem'));
    expect(mockNavigate).toHaveBeenCalledWith('/docs/readme.md');
  });

  it('fires navigate on Enter key', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    fireEvent.keyDown(screen.getByRole('treeitem'), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/docs/readme.md');
  });

  it('adds is-active class when currentFile matches', () => {
    mockState.currentFile = '/docs/readme.md';
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('treeitem').className).toContain('is-active');
  });

  it('does not add is-active class when currentFile differs', () => {
    mockState.currentFile = '/docs/other.md';
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('treeitem').className).not.toContain('is-active');
  });

  it('adds is-cursor class in cursor mode when cursorItemId matches', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} cursorMode={true} cursorItemId="/docs/readme.md" />);
    expect(screen.getByRole('treeitem').className).toContain('is-cursor');
  });

  it('does not add is-cursor class when cursorItemId does not match', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} cursorMode={true} cursorItemId="/other" />);
    expect(screen.getByRole('treeitem').className).not.toContain('is-cursor');
  });

  it('does not add is-cursor class when cursorMode is false', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} cursorMode={false} cursorItemId="/docs/readme.md" />);
    expect(screen.getByRole('treeitem').className).not.toContain('is-cursor');
  });

  it('adds is-scope-editing class when scope editing is active', () => {
    const editingScope = { ...defaultScopeFocus, editing: true };
    render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    expect(screen.getByRole('treeitem').className).toContain('is-scope-editing');
  });

  it('renders ScopeCheckbox when scope editing is active', () => {
    const editingScope = { ...defaultScopeFocus, editing: true };
    render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('does not render ScopeCheckbox when scope editing is inactive', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('calls onFileChange when scope checkbox is toggled', () => {
    const onFileChange = vi.fn();
    const editingScope = { ...defaultScopeFocus, editing: true, onFileChange };
    render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onFileChange).toHaveBeenCalledWith('/docs/readme.md', false);
  });

  it('checks scope checkbox when file is in selectedFilePaths', () => {
    const editingScope = { ...defaultScopeFocus, editing: true, selectedFilePaths: new Set(['/docs/readme.md']) };
    render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('unchecks scope checkbox when file is not in selectedFilePaths', () => {
    const editingScope = { ...defaultScopeFocus, editing: true, selectedFilePaths: new Set() };
    render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('sets data-path attribute', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('treeitem')).toHaveAttribute('data-path', '/docs/readme.md');
  });

  it('sets aria-selected when active', () => {
    mockState.currentFile = '/docs/readme.md';
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-selected', 'true');
  });

  it('defaults cursorMode to false', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('treeitem').className).not.toContain('is-cursor');
  });

  it('defaults to checked when scopeFocus is undefined', () => {
    const editingScope: ScopeFocusTreeProps = {
      editing: true,
      hideUnselected: false,
      selectedFilePaths: new Set(['/docs/readme.md']),
      onFileChange: vi.fn(),
      onFolderChange: vi.fn(),
    };
    const { rerender } = render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('does not render the three-dot action button without a menu callback', () => {
    render(<FileNode file={baseFile} scopeFocus={defaultScopeFocus} />);
    expect(screen.queryByLabelText('Actions for Readme')).not.toBeInTheDocument();
  });

  it('requests the file action menu from the three-dot button', () => {
    const onRequestItemMenu = vi.fn();
    render(
      <FileNode
        file={baseFile}
        scopeFocus={defaultScopeFocus}
        onRequestItemMenu={onRequestItemMenu}
        itemActionsLabel="Actions for {name}"
      />,
    );

    fireEvent.click(screen.getByLabelText('Actions for Readme'));

    expect(onRequestItemMenu).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'file',
      path: '/docs/readme.md',
      anchor: expect.any(HTMLElement),
    }));
  });

  it('hides the file action button when canRequestItemMenu rejects the target', () => {
    render(
      <FileNode
        file={baseFile}
        scopeFocus={defaultScopeFocus}
        onRequestItemMenu={vi.fn()}
        canRequestItemMenu={() => false}
        itemActionsLabel="Actions for {name}"
      />,
    );

    expect(screen.queryByLabelText('Actions for Readme')).not.toBeInTheDocument();
  });

  it('stops propagation on checkbox click and keydown', () => {
    const editingScope = { ...defaultScopeFocus, editing: true };
    render(<FileNode file={baseFile} scopeFocus={editingScope} />);
    const checkbox = screen.getByRole('checkbox');
    const clickStop = vi.spyOn(checkbox, 'click');
    fireEvent.click(checkbox);
    expect(mockNavigate).not.toHaveBeenCalledTimes(1);
  });
});

describe('FolderNodeView', () => {
  const simpleNode = {
    name: 'guides',
    path: '/docs/guides',
    files: [baseFile],
    children: [],
  };

  beforeEach(() => {
    mockState = createMockState();
    mockNavigate.mockClear();
  });

  it('renders folder name', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(screen.getByText('guides')).toBeInTheDocument();
  });

  it('requests the folder action menu from the three-dot button', () => {
    const onRequestItemMenu = vi.fn();
    const relativeNode = { ...simpleNode, path: 'guides' };
    render(
      <FolderNodeView
        node={relativeNode}
        filter=""
        scopeFocus={defaultScopeFocus}
        onRequestItemMenu={onRequestItemMenu}
        itemActionsLabel="Actions for {name}"
      />,
    );

    fireEvent.click(screen.getByLabelText('Actions for guides'));

    expect(onRequestItemMenu).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'folder',
      path: 'guides',
      anchor: expect.any(HTMLElement),
    }));
  });

  it('renders folder with is-open class by default', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(document.querySelector('.tree-folder')!.className).toContain('is-open');
  });

  it('toggles open/collapsed on header click', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    const header = screen.getByRole('button');
    fireEvent.click(header);
    expect(document.querySelector('.tree-folder')!.className).not.toContain('is-open');
    fireEvent.click(header);
    expect(document.querySelector('.tree-folder')!.className).toContain('is-open');
  });

  it('toggles on Enter key', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    const header = screen.getByRole('button');
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(document.querySelector('.tree-folder')!.className).not.toContain('is-open');
  });

  it('toggles on Space key', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    const header = screen.getByRole('button');
    fireEvent.keyDown(header, { key: ' ' });
    expect(document.querySelector('.tree-folder')!.className).not.toContain('is-open');
  });

  it('renders child FileNodes when open', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(screen.getByText('Readme')).toBeInTheDocument();
  });

  it('hides children when collapsed', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    const header = screen.getByRole('button');
    fireEvent.click(header);
    expect(screen.queryByText('Readme')).not.toBeInTheDocument();
  });

  it('renders ScopeCheckbox when scope editing is active', () => {
    const editingScope = { ...defaultScopeFocus, editing: true };
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={editingScope} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('adds is-scope-editing class when editing', () => {
    const editingScope = { ...defaultScopeFocus, editing: true };
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={editingScope} />);
    expect(document.querySelector('.tree-folder')!.className).toContain('is-scope-editing');
  });

  it('calls onFolderChange when folder scope checkbox clicked', () => {
    const onFolderChange = vi.fn();
    const editingScope = { ...defaultScopeFocus, editing: true, onFolderChange };
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={editingScope} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onFolderChange).toHaveBeenCalled();
  });

  it('returns null when no visible content due to filter', () => {
    const { container } = render(<FolderNodeView node={simpleNode} filter="nonexistent" scopeFocus={defaultScopeFocus} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when all files hidden by scope focus', () => {
    const scopeHideAll = { ...defaultScopeFocus, hideUnselected: true, selectedFilePaths: new Set<string>() };
    const { container } = render(<FolderNodeView node={simpleNode} filter="" scopeFocus={scopeHideAll} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nested folder children', () => {
    const nestedNode = {
      name: 'docs',
      path: '/docs',
      files: [],
      children: [simpleNode],
    };
    render(<FolderNodeView node={nestedNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('guides')).toBeInTheDocument();
  });

  it('adds is-cursor class in cursor mode when cursorItemId matches folder', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} cursorMode={true} cursorItemId="folder:/docs/guides" />);
    expect(screen.getByRole('button').className).toContain('is-cursor');
  });

  it('clears lastExpandedFileRef when currentFile leaves the folder', () => {
    mockState.currentFile = '/docs/guides/readme.md';
    const { rerender } = render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    mockState.currentFile = '/other.md';
    rerender(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(document.querySelector('.tree-folder')!.className).toContain('is-open');
  });

  it('sets aria-expanded to true when open', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets data-sidebar-cursor-item on header', () => {
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={defaultScopeFocus} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-sidebar-cursor-item', 'true');
  });

  it('renders folder with indeterminate checkbox when some descendants selected', () => {
    const partialScope = {
      ...defaultScopeFocus,
      editing: true,
      selectedFilePaths: new Set<string>(),
    };
    render(<FolderNodeView node={simpleNode} filter="" scopeFocus={partialScope} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('expands folder when locate-active-file event fires', () => {
    const nodeWithInternalFile = {
      name: 'guides',
      path: '/docs/guides',
      files: [{ fsPath: '/docs/guides/readme.md', relativePath: 'guides/readme.md', fileName: 'readme.md', title: 'Guides Readme' }],
      children: [],
    };
    mockState.currentFile = '/docs/guides/readme.md';
    render(<FolderNodeView node={nodeWithInternalFile} filter="" scopeFocus={defaultScopeFocus} />);
    const header = screen.getByRole('button');
    fireEvent.click(header);
    expect(document.querySelector('.tree-folder')!.className).not.toContain('is-open');
    mockState.currentFile = '/docs/guides/readme.md';
    act(() => { window.dispatchEvent(new CustomEvent('locate-active-file')); });
  });
});
