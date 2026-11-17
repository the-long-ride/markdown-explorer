import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WelcomeFeaturesGrid } from '../../../../ui/src/components/Content/WelcomeFeaturesGrid';
import type { AppSettings } from '../../../../ui/src/themeTypes';

const mockSettings: AppSettings = {
  theme: 'dark',
  themeStyle: 'default',
  syncThemeWithOS: false,
  autoLightPreset: 'default',
  codeTheme: 'github-dark',
  sidebarCollapsed: false,
  tocCollapsed: false,
  tableOfContentsPosition: 'right',
  pinnedFiles: [],
  sidebarWidth: 260,
  fontSize: 14,
  fontFamily: 'system-ui',
  customFontFamily: '',
  readingLineLength: 'medium',
  enableVimMode: false,
  keyboardShortcuts: {},
  keyboardShortcutsEnabled: true,
  customThemes: [],
  remixRecipes: [],
  activeRemixRecipe: null,
  recentWorkspaces: [],
  recentWorkspacesLimit: 10,
  language: 'en',
  keybindings: {},
};

const mockFeatures = {
  tree: { title: 'File Tree', desc: 'Browse markdown workspaces effortlessly.' },
  search: { title: 'Search & Find', desc: 'Find documents instantly.' },
  editor: { title: 'Live Editor', desc: 'Split pane real-time Markdown editing.' },
  tables: { title: 'Interactive Tables', desc: 'Insert and resize markdown tables.' },
  charts: { title: 'Table Charts', desc: 'Generate visual charts from tables.' },
  highlight: { title: 'Syntax Highlighting', desc: 'Highlighting for 50+ languages.' },
  insights: { title: 'Workspace Insights', desc: 'Interactive graph and reports.' },
  git: { title: 'Git History', desc: 'Visual timeline with branch tags.' },
  export: { title: 'Export Center', desc: 'Export documents to HTML and PDF.' },
  outline: { title: 'Document Outline', desc: 'Jump to headers and sections.' },
  bookmarks: { title: 'Bookmarks', desc: 'Keep track of important files.' },
  html: { title: 'HTML Sandboxes', desc: 'Preview embedded HTML safely.' },
  modal: { title: 'Media Viewer', desc: 'Expand media in full screen.' },
  themes: { title: 'Themes & Styles', desc: 'Personalize with 7 vivid themes.' },
  shortcuts: { title: 'Keyboard Shortcuts', desc: 'Full keyboard navigation.', vscodeDesc: 'Custom VSCode bindings.' },
};

describe('WelcomeFeaturesGrid', () => {
  it('renders all feature cards when enabled on desktop with editor support', () => {
    const onViewShortcuts = vi.fn();
    render(
      <WelcomeFeaturesGrid
        features={mockFeatures as any}
        settings={mockSettings}
        isDesktop={true}
        supportsEditor={true}
        viewShortcutsLabel="View all shortcuts"
        onViewShortcuts={onViewShortcuts}
      />,
    );

    expect(screen.getByText('File Tree')).toBeInTheDocument();
    expect(screen.getByText('Search & Find')).toBeInTheDocument();
    expect(screen.getByText('Live Editor')).toBeInTheDocument();
    expect(screen.getByText('Interactive Tables')).toBeInTheDocument();
    expect(screen.getByText('Table Charts')).toBeInTheDocument();
    expect(screen.getByText('Syntax Highlighting')).toBeInTheDocument();
    expect(screen.getByText('Workspace Insights')).toBeInTheDocument();
    expect(screen.getByText('Git History')).toBeInTheDocument();
    expect(screen.getByText('Export Center')).toBeInTheDocument();
    expect(screen.getByText('Document Outline')).toBeInTheDocument();
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
    expect(screen.getByText('HTML Sandboxes')).toBeInTheDocument();
    expect(screen.getByText('Media Viewer')).toBeInTheDocument();
    expect(screen.getByText('Themes & Styles')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    const shortcutBtn = screen.getByRole('button', { name: /View all shortcuts/i });
    expect(shortcutBtn).toBeInTheDocument();
    fireEvent.click(shortcutBtn);
    expect(onViewShortcuts).toHaveBeenCalledTimes(1);
  });

  it('renders correctly with partial features object', () => {
    render(
      <WelcomeFeaturesGrid
        features={{
          tree: mockFeatures.tree,
          export: mockFeatures.export,
        } as any}
        settings={mockSettings}
        isDesktop={false}
        supportsEditor={false}
        viewShortcutsLabel="View all shortcuts"
        onViewShortcuts={vi.fn()}
      />,
    );

    expect(screen.getByText('File Tree')).toBeInTheDocument();
    expect(screen.getByText('Export Center')).toBeInTheDocument();
    expect(screen.queryByText('Live Editor')).toBeNull();
    expect(screen.queryByText('Workspace Insights')).toBeNull();
  });
});
