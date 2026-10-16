import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileNode, FolderNodeView } from '../../../../ui/src/components/Sidebar/TreeNode';
import type { ScopeFocusTreeProps } from '../../../../ui/src/components/Sidebar/TreeNode';
import { SidebarTreeEntryContext, type SidebarTreeEntryContextValue } from '../../../../ui/src/components/Sidebar/sidebarTreeContext';
import type { FolderNode, MdFile } from '../../../../ui/src/types';

const mockNavigate = vi.fn();
const mockState: any = {
  currentFile: null,
  workspacePath: '/ws',
  appRuntime: 'vscode',
  hostPlatform: 'unknown',
  settings: { showTitle: true, language: 'en' },
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState, navigate: mockNavigate, updateSettings: vi.fn() }),
}));

afterEach(cleanup);
beforeEach(() => mockNavigate.mockClear());

const file: MdFile = { fsPath: '/ws/docs/a.md', relativePath: 'docs/a.md', fileName: 'a.md', title: 'Alpha' } as MdFile;
const deep: FolderNode = { name: 'deep', path: 'docs/deep', files: [], children: [] };
const docs: FolderNode = { name: 'docs', path: 'docs', files: [file], children: [deep] };
const scope: ScopeFocusTreeProps = {
  editing: false, hideUnselected: false, selectedFilePaths: new Set(), onFileChange: vi.fn(), onFolderChange: vi.fn(),
};
const ordering = { pinnedKeys: new Set<string>(), sortMode: 'name-asc' as const };

const ctx = (patch: Partial<SidebarTreeEntryContextValue> = {}): SidebarTreeEntryContextValue => ({
  inlineParentPath: null, inlineInput: null, revealPath: null, selectionActive: false,
  isSelected: () => false, toggleSelected: vi.fn(), selectItemLabel: 'Select {name}', rememberFocus: vi.fn(), ...patch,
});
const wrap = (value: SidebarTreeEntryContextValue | null, child: ReactNode) => (
  <SidebarTreeEntryContext.Provider value={value}>{child}</SidebarTreeEntryContext.Provider>
);
const folder = (extra: Record<string, unknown> = {}) => (
  <FolderNodeView node={docs} filter="" scopeFocus={scope} ordering={ordering} {...extra} />
);
const headerEl = (container: HTMLElement) => container.querySelector('.tree-folder__header') as HTMLElement;

describe('TreeNode with sidebar entry context', () => {
  it('selection mode: folder header toggles selection, not expansion; chevron expands', () => {
    const value = ctx({ selectionActive: true });
    const { container } = render(wrap(value, folder()));
    const head = headerEl(container);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(head);
    expect(value.toggleSelected).toHaveBeenCalledWith('folder', 'docs');
    expect(head.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(container.querySelector('.tree-folder__chevron') as HTMLElement);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(value.toggleSelected).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(head, { key: 'Enter' });
    expect(value.toggleSelected).toHaveBeenCalledTimes(2);
    expect(head.getAttribute('aria-expanded')).toBe('false');
  });

  it('normal mode: header toggles expansion and remembers focus', () => {
    const value = ctx();
    const { container } = render(wrap(value, folder()));
    fireEvent.click(headerEl(container));
    expect(value.rememberFocus).toHaveBeenCalledWith('folder', 'docs');
    expect(value.toggleSelected).not.toHaveBeenCalled();
    expect(headerEl(container).getAttribute('aria-expanded')).toBe('false');
  });

  it('selection mode: clicking a file selects it instead of navigating', () => {
    const value = ctx({ selectionActive: true });
    render(wrap(value, <FileNode file={file} scopeFocus={scope} ordering={ordering} />));
    fireEvent.click(screen.getByRole('treeitem'));
    expect(value.toggleSelected).toHaveBeenCalledWith('file', '/ws/docs/a.md');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('normal mode: clicking a file navigates and remembers focus', () => {
    const value = ctx();
    render(wrap(value, <FileNode file={file} scopeFocus={scope} ordering={ordering} />));
    fireEvent.click(screen.getByRole('treeitem'));
    expect(value.rememberFocus).toHaveBeenCalledWith('file', '/ws/docs/a.md');
    expect(mockNavigate).toHaveBeenCalledWith('/ws/docs/a.md');
  });

  it('applies is-selected to selected file and folder rows', () => {
    const value = ctx({ selectionActive: true, isSelected: (key) => key === 'file:/ws/docs/a.md' || key === 'folder:docs' });
    const { container } = render(wrap(value, folder()));
    expect(headerEl(container).className).toContain('is-selected');
    expect((container.querySelector('.tree-file') as HTMLElement).className).toContain('is-selected');
  });

  it('renders the inline input first inside the target folder children', () => {
    const value = ctx({ inlineParentPath: 'docs', inlineInput: <div data-testid="inline-input">input</div> });
    const { container } = render(wrap(value, folder()));
    const group = container.querySelector('.tree-folder > .tree-folder__children') as HTMLElement;
    expect(group.firstElementChild).toBe(screen.getByTestId('inline-input'));
  });

  it('force-opens collapsed ancestors of the inline input path', () => {
    const collapsed = { version: 1, expanded: false };
    const { container, rerender } = render(wrap(ctx(), folder({ expansionCommand: collapsed })));
    expect(headerEl(container).getAttribute('aria-expanded')).toBe('false');
    const value = ctx({ inlineParentPath: 'docs/deep', inlineInput: <div data-testid="inline-input">input</div> });
    rerender(wrap(value, folder({ expansionCommand: collapsed })));
    expect(headerEl(container).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('inline-input')).toBeTruthy();
  });

  it('re-expands every collapsed ancestor of a nested reveal path', () => {
    const collapsed = { version: 1, expanded: false };
    const { container, rerender } = render(wrap(ctx(), folder({ expansionCommand: collapsed })));
    expect(headerEl(container).getAttribute('aria-expanded')).toBe('false');
    rerender(wrap(ctx({ revealPath: 'docs/deep' }), folder({ expansionCommand: collapsed })));
    const headers = Array.from(container.querySelectorAll('.tree-folder__header'));
    expect(headers.map((header) => header.getAttribute('aria-expanded'))).toEqual(['true', 'true']);
  });

  it('reports an open folder being collapsed by the user, but not an expansion', () => {
    const onFolderCollapsed = vi.fn();
    const { container } = render(wrap(ctx({ onFolderCollapsed }), folder()));
    fireEvent.click(headerEl(container));
    expect(onFolderCollapsed).toHaveBeenCalledTimes(1);
    expect(onFolderCollapsed).toHaveBeenCalledWith('docs');
    fireEvent.click(headerEl(container));
    expect(onFolderCollapsed).toHaveBeenCalledTimes(1);
  });

  it('behaves as before when there is no context', () => {
    const { container } = render(wrap(null, folder()));
    expect(container.querySelector('.sidebar-entry-checkbox')).toBeNull();
    fireEvent.click(headerEl(container));
    expect(headerEl(container).getAttribute('aria-expanded')).toBe('false');
  });
});
