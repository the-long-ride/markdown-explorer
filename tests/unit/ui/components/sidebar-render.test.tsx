import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../../../../ui/src/components/Sidebar/Sidebar';

const mockDispatch = vi.fn();
const mockUpdateSettings = vi.fn();
const mockNavigate = vi.fn();

let mockState: any = {
  sidebarActiveTab: 'files',
  sidebarCollapsed: false,
  workspacePath: '/docs',
  workspaceName: 'Docs',
  settings: { language: 'en', scopeFocus: {}, keybindings: {}, defaultHtmlPreview: true },
  currentFile: null,
  currentHtmlPreviewOverride: undefined,
  contentTabs: [],
  appRuntime: 'vscode',
  hostPlatform: 'unknown',
  fileList: [
    { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
  ],
  tree: {
    name: 'Docs',
    path: '/docs',
    files: [{ fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' }],
    children: [],
  },
};

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => {}),
  }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    dispatch: mockDispatch,
    updateSettings: mockUpdateSettings,
    navigate: mockNavigate,
  }),
}));

vi.mock('../../../../ui/src/components/Sidebar/SidebarSearch', () => ({
  SidebarSearch: ({ isVisible }: any) => <div data-testid="sidebar-search" data-visible={isVisible} />,
}));

vi.mock('../../../../ui/src/components/Sidebar/TreeNode', () => ({
  FileNode: ({ file }: any) => <div data-testid="file-node">{file.title}</div>,
  FolderNodeView: ({ node, expansionCommand }: any) => (
    <div
      data-testid="folder-node"
      data-expansion-version={expansionCommand?.version ?? 0}
      data-expansion-expanded={String(expansionCommand?.expanded ?? true)}
    >
      {node.name}
    </div>
  ),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, label, tooltip, ...props }: any) => (
    <button
      onClick={onClick}
      aria-label={label || tooltip}
      {...props}
    >
      {icon}{children}
    </button>
  ),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    sidebar: {
      files: 'Files',
      search: 'Search',
      filterPlaceholder: 'Filter...',
      filterAriaLabel: 'Filter files',
      scopeFocus: 'Scope',
      clearScopeFocus: 'Clear',
      collapseAllFolders: 'Collapse all folders',
      expandAllFolders: 'Expand all folders',
      noFiles: 'No files',
      noScopeFiles: 'No matching files',
    },
    tooltips: { locateFile: 'Locate' },
  }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CheckIcon: () => <span>check-icon</span>,
  CloseIcon: () => <span>close-icon</span>,
  SearchIcon: () => <span>search-icon</span>,
  LocateIcon: () => <span>locate-icon</span>,
  FolderIcon: () => <span>folder-icon</span>,
  CollapseIcon: () => <span>collapse-icon</span>,
  ExpandIcon: () => <span>expand-icon</span>,
}));

describe('Sidebar render', () => {
  beforeEach(() => {
    mockState = {
      sidebarActiveTab: 'files',
      sidebarCollapsed: false,
      workspacePath: '/docs',
      workspaceName: 'Docs',
      settings: { language: 'en', scopeFocus: {}, keybindings: {}, defaultHtmlPreview: true },
      currentFile: null,
      currentHtmlPreviewOverride: undefined,
      contentTabs: [],
      appRuntime: 'vscode',
      hostPlatform: 'unknown',
      fileList: [
        { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      ],
      tree: {
        name: 'Docs',
        path: '/docs',
        files: [{ fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' }],
        children: [],
      },
    };
    mockDispatch.mockClear();
    mockUpdateSettings.mockClear();
    mockNavigate.mockClear();
  });

  it('renders the sidebar nav element', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('id', 'sidebar');
  });

  it('renders file tab and search tab buttons', () => {
    render(<Sidebar />);
    const tabBtns = screen.getAllByRole('button').filter((btn) =>
      btn.className.includes('sidebar__tab-btn'),
    );
    expect(tabBtns).toHaveLength(2);
    expect(tabBtns[0]).toHaveTextContent('Files');
    expect(tabBtns[1]).toHaveTextContent('Search');
  });

  it('marks the files tab as active when sidebarActiveTab is files', () => {
    mockState.sidebarActiveTab = 'files';
    render(<Sidebar />);
    const filesTab = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__tab-btn--files'),
    );
    expect(filesTab).toBeTruthy();
    expect(filesTab!.className).toContain('is-active');
  });

  it('marks the search tab as active when sidebarActiveTab is search', () => {
    mockState.sidebarActiveTab = 'search';
    render(<Sidebar />);
    const searchTab = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__tab-btn') && !btn.className.includes('sidebar__tab-btn--files'),
    );
    expect(searchTab).toBeTruthy();
    expect(searchTab!.className).toContain('is-active');
  });

  it('dispatches SET_SIDEBAR_ACTIVE_TAB with files on files tab click', () => {
    render(<Sidebar />);
    const filesTab = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__tab-btn--files'),
    );
    fireEvent.click(filesTab!);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab: 'files' });
  });

  it('dispatches SET_SIDEBAR_ACTIVE_TAB with search on search tab click', () => {
    render(<Sidebar />);
    const searchTab = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__tab-btn') && !btn.className.includes('sidebar__tab-btn--files'),
    );
    fireEvent.click(searchTab!);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab: 'search' });
  });

  it('renders filter input', () => {
    render(<Sidebar />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Filter...');
    expect(input).toHaveAttribute('aria-label', 'Filter files');
  });

  it('updates filter input value on typing', () => {
    render(<Sidebar />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'read' } });
    expect(input).toHaveValue('read');
  });

  it('renders file tree items from tree files', () => {
    render(<Sidebar />);
    const fileNodes = screen.getAllByTestId('file-node');
    expect(fileNodes).toHaveLength(1);
    expect(fileNodes[0]).toHaveTextContent('Readme');
  });

  it('renders folder tree items from tree children', () => {
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: [],
      children: [
        {
          name: 'guides',
          path: '/docs/guides',
          files: [{ fsPath: '/docs/guides/intro.md', relativePath: 'guides/intro.md', fileName: 'intro.md', title: 'Intro' }],
          children: [],
        },
      ],
    };
    mockState.fileList = [
      { fsPath: '/docs/guides/intro.md', relativePath: 'guides/intro.md', fileName: 'intro.md', title: 'Intro' },
    ];
    render(<Sidebar />);
    const folderNodes = screen.getAllByTestId('folder-node');
    expect(folderNodes).toHaveLength(1);
    expect(folderNodes[0]).toHaveTextContent('guides');
  });

  it('renders files tab panel visible and search panel hidden when files tab is active', () => {
    mockState.sidebarActiveTab = 'files';
    render(<Sidebar />);
    const panels = document.querySelectorAll('.sidebar__tab-panel');
    expect(panels).toHaveLength(2);
    expect(panels[0].className).not.toContain('is-hidden');
    expect(panels[1].className).toContain('is-hidden');
  });

  it('renders search panel visible and files panel hidden when search tab is active', () => {
    mockState.sidebarActiveTab = 'search';
    render(<Sidebar />);
    const panels = document.querySelectorAll('.sidebar__tab-panel');
    expect(panels[0].className).toContain('is-hidden');
    expect(panels[1].className).not.toContain('is-hidden');
  });

  it('renders SidebarSearch with isVisible=true when search tab is active', () => {
    mockState.sidebarActiveTab = 'search';
    render(<Sidebar />);
    const searchPanel = screen.getByTestId('sidebar-search');
    expect(searchPanel).toBeInTheDocument();
    expect(searchPanel).toHaveAttribute('data-visible', 'true');
  });

  it('renders SidebarSearch with isVisible=false when files tab is active', () => {
    mockState.sidebarActiveTab = 'files';
    render(<Sidebar />);
    const searchPanel = screen.getByTestId('sidebar-search');
    expect(searchPanel).toHaveAttribute('data-visible', 'false');
  });

  it('returns null when tree is null', () => {
    mockState.tree = null;
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toBe('');
  });

  it('shows No files when tree has no visible items and no scope entry', () => {
    mockState.tree = { name: 'Docs', path: '/docs', files: [], children: [] };
    mockState.fileList = [];
    render(<Sidebar />);
    expect(screen.getByText('No files')).toBeInTheDocument();
  });

  it('shows No matching files when tree has no visible items and scope entry exists', () => {
    mockState.tree = { name: 'Docs', path: '/docs', files: [], children: [] };
    mockState.fileList = [];
    mockState.settings.scopeFocus = { '/docs': ['/docs/gone.md'] };
    render(<Sidebar />);
    expect(screen.getByText('No matching files')).toBeInTheDocument();
  });

  it('renders scope focus button', () => {
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    expect(scopeBtn).toBeTruthy();
    expect(scopeBtn!.textContent).toContain('Scope');
  });

  it('toggles scope focus editing on button click', () => {
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    expect(scopeBtn!.className).not.toContain('is-active');
    fireEvent.click(scopeBtn!);
    expect(scopeBtn!.className).toContain('is-active');
    fireEvent.click(scopeBtn!);
    expect(scopeBtn!.className).not.toContain('is-active');
  });

  it('shows an uncheck-all action while editing a fully selected scope', () => {
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    fireEvent.click(scopeBtn!);
    expect(screen.getByRole('button', { name: 'Uncheck all' })).toBeInTheDocument();
  });

  it('checks all files when the scope is partially selected', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = { name: 'Docs', path: '/docs', files: mockState.fileList, children: [] };
    mockState.settings.scopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    fireEvent.click(scopeBtn!);
    fireEvent.click(screen.getByRole('button', { name: 'Check all' }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ scopeFocus: {} });
  });

  it('unchecks all files from a fully selected scope', () => {
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    fireEvent.click(scopeBtn!);
    fireEvent.click(screen.getByRole('button', { name: 'Uncheck all' }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ scopeFocus: { '/docs': [] } });
  });

  it('renders scope count showing total files when no scope entry', () => {
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    const countSpan = scopeBtn!.querySelector('.sidebar__scope-count');
    expect(countSpan).toHaveTextContent('1/1');
  });

  it('renders scope count showing selected files when scope entry exists', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: mockState.fileList,
      children: [],
    };
    mockState.settings.scopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    const countSpan = scopeBtn!.querySelector('.sidebar__scope-count');
    expect(countSpan).toHaveTextContent('1/2');
  });

  it('renders clear scope button when scope entry exists', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: mockState.fileList,
      children: [],
    };
    mockState.settings.scopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<Sidebar />);
    const clearBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-clear'),
    );
    expect(clearBtn).toBeTruthy();
  });

  it('calls updateSettings on clear scope focus click', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: mockState.fileList,
      children: [],
    };
    mockState.settings.scopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<Sidebar />);
    const clearBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-clear'),
    );
    fireEvent.click(clearBtn!);
    expect(mockUpdateSettings).toHaveBeenCalledWith({ scopeFocus: {} });
  });

  it('adds is-collapsed class when sidebarCollapsed is true', () => {
    mockState.sidebarCollapsed = true;
    render(<Sidebar />);
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('is-collapsed');
  });

  it('does not add is-collapsed class when sidebarCollapsed is false', () => {
    mockState.sidebarCollapsed = false;
    render(<Sidebar />);
    const nav = screen.getByRole('navigation');
    expect(nav.className).not.toContain('is-collapsed');
  });

  it('adds is-cursor-mode class when cursorMode is true', () => {
    render(<Sidebar cursorMode={true} />);
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('is-cursor-mode');
  });

  it('does not add is-cursor-mode class when cursorMode is false', () => {
    render(<Sidebar cursorMode={false} />);
    const nav = screen.getByRole('navigation');
    expect(nav.className).not.toContain('is-cursor-mode');
  });

  it('renders file count in the title actions', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: mockState.fileList,
      children: [],
    };
    render(<Sidebar />);
    const countEl = document.getElementById('fileCount');
    expect(countEl).toHaveTextContent('2');
  });

  it('renders enabled locate action when currentFile is set', () => {
    mockState.currentFile = '/docs/readme.md';
    render(<Sidebar />);
    const locateBtn = screen.getByRole('button', { name: 'Locate' });
    expect(locateBtn).toHaveClass('sidebar__files-action--locate');
    expect(locateBtn).toBeEnabled();
  });

  it('keeps locate action visible but disabled when currentFile is null', () => {
    mockState.currentFile = null;
    render(<Sidebar />);
    const locateBtn = screen.getByRole('button', { name: 'Locate' });
    expect(locateBtn).toHaveClass('sidebar__files-action--locate');
    expect(locateBtn).toBeDisabled();
  });

  it('does not render locate inside the title actions', () => {
    mockState.currentFile = '/docs/readme.md';
    render(<Sidebar />);
    expect(document.querySelector('.sidebar__title-actions .sidebar__files-action--locate')).toBeNull();
  });

  it('sets aria-label with cursor mode text when cursorMode is true', () => {
    render(<Sidebar cursorMode={true} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'File navigation, cursor mode active');
  });

  it('sets aria-label without cursor mode text when cursorMode is false', () => {
    render(<Sidebar cursorMode={false} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'File navigation');
  });

  it('renders tab indicator span', () => {
    render(<Sidebar />);
    const indicator = document.querySelector('.sidebar__tab-indicator');
    expect(indicator).toBeInTheDocument();
  });

  it('tab indicator has no search modifier for files tab', () => {
    mockState.sidebarActiveTab = 'files';
    render(<Sidebar />);
    const indicator = document.querySelector('.sidebar__tab-indicator') as HTMLElement;
    expect(indicator).not.toHaveClass('is-search');
  });

  it('tab indicator has search modifier for search tab', () => {
    mockState.sidebarActiveTab = 'search';
    render(<Sidebar />);
    const indicator = document.querySelector('.sidebar__tab-indicator') as HTMLElement;
    expect(indicator).toHaveClass('is-search');
  });

  it('renders tree container with role tree', () => {
    render(<Sidebar />);
    const tree = screen.getByRole('tree');
    expect(tree).toBeInTheDocument();
    expect(tree).toHaveAttribute('id', 'sidebarTree');
  });

  it('hides files matching filter', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: mockState.fileList,
      children: [],
    };
    render(<Sidebar />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'read' } });
    const fileNodes = screen.getAllByTestId('file-node');
    expect(fileNodes).toHaveLength(1);
    expect(fileNodes[0]).toHaveTextContent('Readme');
  });

  it('shows no files message when filter matches nothing', () => {
    render(<Sidebar />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No files')).toBeInTheDocument();
  });

  it('renders title row', () => {
    render(<Sidebar />);
    const titleRow = document.querySelector('.sidebar__title-row');
    expect(titleRow).toBeInTheDocument();
  });

  it('renders tab strip', () => {
    render(<Sidebar />);
    const tabStrip = document.querySelector('.sidebar__tab-strip');
    expect(tabStrip).toBeInTheDocument();
  });

  it('renders header fields with search and scope sections', () => {
    mockState.sidebarActiveTab = 'files';
    render(<Sidebar />);
    const headerFields = document.querySelector('.sidebar__header-fields');
    expect(headerFields).toBeInTheDocument();
    expect(document.querySelector('.sidebar__search')).toBeInTheDocument();
    expect(document.querySelector('.sidebar__files-actions')).toBeInTheDocument();
    expect(document.querySelector('.sidebar__scope')).toBeInTheDocument();
  });

  it('renders locate, collapse, expand, sort, and clear-pins actions in one Files toolbar', () => {
    render(<Sidebar />);
    const toolbar = document.querySelector('.sidebar__files-actions');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar?.querySelectorAll('.sidebar__files-action')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Collapse all folders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand all folders' })).toBeInTheDocument();
  });

  it('issues versioned collapse and expand commands to folder nodes', () => {
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: [],
      children: [{ name: 'guides', path: '/docs/guides', files: [], children: [] }],
    };
    render(<Sidebar />);
    const folder = screen.getByTestId('folder-node');
    expect(folder).toHaveAttribute('data-expansion-version', '0');
    expect(folder).toHaveAttribute('data-expansion-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all folders' }));
    expect(folder).toHaveAttribute('data-expansion-version', '1');
    expect(folder).toHaveAttribute('data-expansion-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Expand all folders' }));
    expect(folder).toHaveAttribute('data-expansion-version', '2');
    expect(folder).toHaveAttribute('data-expansion-expanded', 'true');
  });

  it('marks scope button as active when scope entry exists', () => {
    mockState.fileList = [
      { fsPath: '/docs/readme.md', relativePath: 'readme.md', fileName: 'readme.md', title: 'Readme' },
      { fsPath: '/docs/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
    ];
    mockState.tree = {
      name: 'Docs',
      path: '/docs',
      files: mockState.fileList,
      children: [],
    };
    mockState.settings.scopeFocus = { '/docs': ['/docs/readme.md'] };
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    expect(scopeBtn!.className).toContain('is-active');
  });

  it('sets aria-pressed on scope button', () => {
    render(<Sidebar />);
    const scopeBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('sidebar__scope-btn'),
    );
    expect(scopeBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(scopeBtn!);
    expect(scopeBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
