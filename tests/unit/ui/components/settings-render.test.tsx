import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsModal, ACTIONS_LIST } from '../../../../ui/src/components/Settings/SettingsModal';

const mockDispatch = vi.fn();
const mockSetTheme = vi.fn();
const mockSetThemeStyle = vi.fn();
const mockUpdateSettings = vi.fn();
const mockPostMessage = vi.fn();
const mockOnMessage = vi.fn(() => () => {});

let mockState: any;

const defaultUpdateCheck = { status: 'idle', currentVersion: '', latestVersion: '', hasUpdate: false, changelogUrl: '' };
const defaultHostUpdateState = { status: 'idle' as const };

function getMockState() {
  return {
    settings: {
      language: 'en',
      showTitle: false,
      fileTabs: true,
      defaultHtmlPreview: false,
      defaultCsvPreview: false,
      documentConversion: false,
      desktopViewMode: 'focus',
      keybindings: {},
      activeCustomThemeId: null,
      customThemes: [],
    },
    theme: 'dark',
    themeStyle: 'default',
    appVersion: '1.0.0',
    recentWorkspaces: [],
  };
}

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    dispatch: mockDispatch,
    setTheme: mockSetTheme,
    setThemeStyle: mockSetThemeStyle,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: mockPostMessage, onMessage: mockOnMessage, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, tooltip, label, onlyIcon = true, tooltipPos: _tooltipPos, tooltipAlign: _tooltipAlign, ...props }: any) => (
    <button onClick={onClick} aria-label={label || tooltip} {...props}>
      {icon}{!onlyIcon && label}{children}
      {tooltip && <span className="tooltip-text">{tooltip}</span>}
    </button>
  ),
}));

vi.mock('../../../../ui/src/components/Settings/ThemeStylePicker', () => ({
  ThemeStylePicker: ({ value, onChange, onOpenThemeRemix }: any) => (
    <div data-testid="theme-style-picker" data-value={value}>
      <button onClick={onChange}>change-style</button>
      <button onClick={onOpenThemeRemix}>open-remix</button>
    </div>
  ),
}));

vi.mock('../../../../ui/src/components/Settings/ThemeRemixModal', () => ({
  ThemeRemixModal: ({ isOpen, onClose }: any) =>
    isOpen ? <div data-testid="theme-remix-modal"><button onClick={onClose}>close-remix</button></div> : null,
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    settings: 'Settings',
    subtitle: 'Customize your view',
    appearance: 'Appearance',
    colorMode: 'Color Mode',
    colorModeDesc: 'Choose color mode.',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    themeStyle: 'Theme Style',
    themeStyleDesc: 'Pick style.',
    viewPrefs: 'View Preferences',
    desktopView: 'Desktop View',
    desktopViewDesc: 'Desktop view mode.',
    focus: 'Focus',
    tabs: 'Tabs',
    sidebarLabels: 'Sidebar Labels',
    sidebarLabelsDesc: 'Show titles.',
    fileTabs: 'File Tabs',
    fileTabsDesc: 'Open files in tabs.',
    documentConversion: 'Document Conversion',
    documentConversionDesc: 'Convert docs.',
    htmlPreview: 'HTML Preview',
    htmlPreviewDesc: 'HTML preview default.',
    csvPreview: 'CSV Preview',
    csvPreviewDesc: 'CSV preview default.',
    importJson: 'Import JSON',
    exportJson: 'Export JSON',
    importJsonTooltip: 'Import all user settings from JSON',
    exportJsonTooltip: 'Export all user settings to JSON',
    shortcuts: 'Keyboard Shortcuts',
    shortcutsHint: 'Click to record.',
    resetShortcuts: 'Reset to Default Shortcuts',
    resetShortcutsConfirmTitle: 'Reset keyboard shortcuts?',
    resetShortcutsConfirmBody: 'Confirm reset',
    confirmResetShortcuts: 'Reset Shortcuts',
    cancelResetShortcuts: 'Cancel',
    closeSettings: 'Close Settings - (Esc)',
    actions: {
      findCurrentFile: 'Find in file',
      searchCurrent: 'Search workspace',
      searchAllTabs: 'Search all tabs',
      back: 'Back',
      forward: 'Forward',
      welcome: 'Welcome',
      settings: 'Settings',
      toggleTheme: 'Toggle theme',
      refresh: 'Refresh',
      collapseAll: 'Collapse',
      expandAll: 'Expand',
      workspaceSelection: 'Workspace',
      toggleSidebar: 'Sidebar',
      toggleToc: 'TOC',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      locateFile: 'Locate',
      toggleFocusMode: 'Focus mode',
      toggleDesktopViewMode: 'Toggle Tabs/Focus view',
    },
    tooltips: {
      switchLanguage: 'Switch Language',
      openChangelog: 'Open changelog',
      closeModal: 'Close modal [Esc]',
      close: 'Close',
      previous: 'Previous',
      next: 'Next',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset Zoom',
    },
    settingsData: {
      groupLabel: 'Settings data',
      imported: 'Imported settings and workspace history.',
      importFailed: 'Import failed.',
      invalidJson: 'The selected file is not valid JSON.',
      missingData: 'The selected file does not contain settings data.',
      wrongFile: 'This is not a Markdown Explorer settings file.',
      unknownSchema: 'This settings file uses an unknown schema version.',
      exported: 'Settings exported.',
      exportFailed: 'Export failed.',
    },
    update: {
      availableTitle: 'New version {version}',
      availableDescription: 'Current version {version}.',
      viewChangelog: 'see changelog',
      downloadButton: 'Download',
      downloading: 'Downloading... {progress}%',
      applying: 'Applying...',
      scheduled: 'Scheduled.',
      updateOnExit: 'Update on Exit',
      restartAndUpdate: 'Restart and Update',
      restartPromptTitle: 'Install update',
      restartPromptBody: 'Version {version} ready.',
      downloadFailed: 'Download failed.',
      installFailed: 'Install failed.',
      stagedMissing: 'Staged missing.',
    },
    bannedShortcutTitle: 'Banned Shortcut',
    bannedShortcutDismiss: 'Dismiss',
    bannedShortcutImeMessage: 'Ctrl+Space is IME.',
    themeStyles: {
      defaultLabel: 'Default',
      defaultDesc: 'Default style',
      glassLabel: 'Glass',
      glassDesc: 'Glass style',
      bentoLabel: 'Bento',
      bentoDesc: 'Bento style',
      petsLabel: 'Pets',
      petsDesc: 'Pets style',
    },
  }),
  LANGUAGE_OPTIONS: [
    { id: 'en', label: 'English' },
    { id: 'vi', label: 'Tiếng Việt' },
  ],
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CopyIcon: () => <span>copy-icon</span>,
  FolderIcon: () => <span>folder-icon</span>,
  AlertTriangleIcon: ({ size }: any) => <span>alert-icon</span>,
  ImportSettingsIcon: () => <span>import-icon</span>,
  ExportSettingsIcon: () => <span>export-icon</span>,
  LanguageIcon: () => <span>lang-icon</span>,
}));

vi.mock('../../../../ui/src/contexts/appStateConstants', () => ({
  THEME_MODE_OPTIONS: [
    { id: 'auto', label: 'Auto' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ],
  getDefaultKeybindings: () => ({ searchCurrent: 'Ctrl+K' }),
}));

vi.mock('../../../../ui/src/settings/settingsImportExport', () => ({
  SettingsImportError: class SettingsImportError extends Error {},
  createSettingsExport: () => '{}',
  parseSettingsImport: () => { throw new Error('Invalid'); },
  restoreLocalUiSettings: () => {},
}));

vi.mock('../../../../ui/src/utils/shortcuts', () => ({
  formatShortcutLabel: (s: string) => s,
  getEnabledShortcut: (settings: any, key: string) => settings?.keybindings?.[key] ?? null,
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    mockState = getMockState();
    mockDispatch.mockClear();
    mockSetTheme.mockClear();
    mockSetThemeStyle.mockClear();
    mockUpdateSettings.mockClear();
    mockPostMessage.mockClear();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders Settings heading', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Settings');
  });

  it('renders Appearance section', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('renders Color Mode section with segmented controls', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const radioGroup = screen.getByRole('radiogroup', { name: 'Color Mode' });
    expect(radioGroup).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('calls setTheme when a color mode option is clicked', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Light'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('renders ThemeStylePicker', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByTestId('theme-style-picker')).toBeInTheDocument();
  });

  it('renders View Preferences section', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('View Preferences')).toBeInTheDocument();
  });

  it('renders Sidebar Labels toggle', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Sidebar Labels')).toBeInTheDocument();
  });

  it('renders File Tabs toggle', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('File Tabs')).toBeInTheDocument();
  });

  it('renders HTML Preview toggle', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('HTML Preview')).toBeInTheDocument();
  });

  it('renders CSV Preview toggle', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('CSV Preview')).toBeInTheDocument();
  });

  it('renders Keyboard Shortcuts section', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('lists workspace selection shortcut on non-desktop platforms', () => {
    delete (window as any).electronAPI;
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('allows workspace selection binding to be recorded on non-desktop platforms', () => {
    mockState = { ...getMockState(), settings: { ...getMockState().settings, keybindings: { workspaceSelection: 'Ctrl+Alt+W' } } };
    const { container } = render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const row = screen.getByText('Workspace').closest('.settings-shortcut-row');
    const input = row?.querySelector('input');
    expect(input).toHaveValue('Ctrl+Alt+W');
    fireEvent.focus(input!);
    fireEvent.keyDown(input!, { key: 'n', ctrlKey: true });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ keybindings: { workspaceSelection: 'Ctrl+N' } });
    expect(container.querySelector('.settings-shortcut-row')).toBeInTheDocument();
  });

  it('renders action shortcut rows', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const shortcutRows = document.querySelectorAll('.settings-shortcut-row');
    expect(shortcutRows.length).toBeGreaterThan(0);
  });

  it('renders desktop keyboard shortcut search and filters rows while typing', () => {
    (window as any).electronAPI = {};

    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );

    const search = screen.getByPlaceholderText('Search keyboard shortcuts...');
    expect(search).toBeInTheDocument();
    expect(search).toHaveClass('settings-shortcuts-search-input');
    expect(screen.getByRole('button', { name: 'Clear keyboard shortcut search' })).toHaveClass(
      'settings-shortcuts-search-clear',
    );

    fireEvent.change(search, { target: { value: 'toggleTheme' } });
    expect(document.querySelectorAll('.settings-shortcut-row')).toHaveLength(1);
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear keyboard shortcut search' }));
    expect(document.querySelectorAll('.settings-shortcut-row').length).toBeGreaterThan(1);

    delete (window as any).electronAPI;
  });

  it('renders keyboard shortcut search across all platform variants', () => {
    delete (window as any).electronAPI;

    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText('Search keyboard shortcuts...')).toBeInTheDocument();
  });

  it('renders Desktop View segmented control with exactly two options', () => {
    (window as any).electronAPI = {};
    mockState = { ...getMockState(), appRuntime: 'desktop' };

    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );

    const control = screen.getByRole('radiogroup', { name: 'Desktop View' });
    expect(control).toHaveClass('segmented-control--two');
    expect(control.querySelectorAll('.segmented-option')).toHaveLength(2);

    delete (window as any).electronAPI;
  });

  it('lists the desktop view toggle shortcut only in the desktop app', () => {
    (window as any).electronAPI = {};
    mockState = {
      ...getMockState(),
      settings: {
        ...getMockState().settings,
        keybindings: { toggleDesktopViewMode: 'Ctrl+Alt+T' },
      },
    };
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const row = screen.getByText('Toggle Tabs/Focus view').closest('.settings-shortcut-row');
    expect(row).toBeInTheDocument();
    expect(row?.querySelector('input')).toHaveValue('Ctrl+Alt+T');

    delete (window as any).electronAPI;
  });

  it('hides the desktop view toggle shortcut outside the desktop app', () => {
    delete (window as any).electronAPI;
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.queryByText('Toggle Tabs/Focus view')).not.toBeInTheDocument();
  });

  it('renders Reset to Default Shortcuts button', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Reset to Default Shortcuts')).toBeInTheDocument();
  });

  it('calls updateSettings with default keybindings on reset click', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Reset to Default Shortcuts'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Shortcuts' }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ keybindings: { searchCurrent: 'Ctrl+K' }, disabledKeybindings: {} });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={onClose}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const closeBtn = screen.getByRole('button', { name: 'Close Settings - (Esc)' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when modal backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={onClose}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders language dropdown button', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const langBtn = document.querySelector('.settings-language-btn');
    expect(langBtn).toBeInTheDocument();
  });

  it('opens language menu on button click', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
    fireEvent.click(langBtn);
    expect(screen.getByRole('listbox', { name: 'Languages' })).toBeInTheDocument();
  });

  it('calls updateSettings on language change', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
    fireEvent.click(langBtn);
    fireEvent.click(screen.getByText('Tiếng Việt'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ language: 'vi' });
  });

  it('renders Export JSON button', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const exportButton = screen.getByRole('button', { name: 'Export JSON' });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton.querySelector('.tooltip-text')).toHaveTextContent('Export all user settings to JSON');
  });

  it('renders Import JSON button', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    const importButton = screen.getByRole('button', { name: 'Import JSON' });
    expect(importButton).toBeInTheDocument();
    expect(importButton.querySelector('.tooltip-text')).toHaveTextContent('Import all user settings from JSON');
  });

  it('renders ThemeRemixModal when style picker triggers it', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={defaultUpdateCheck}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('open-remix'));
    expect(screen.getByTestId('theme-remix-modal')).toBeInTheDocument();
  });

  it('renders version label when updateCheck has currentVersion', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={{ ...defaultUpdateCheck, currentVersion: 'v1.2.3' }}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('v1.2.3')).toBeInTheDocument();
  });

  it('renders update card when update is available', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={{ status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' }}
        hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('renders downloaded update restart modal when update is downloaded', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        updateCheck={{ status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' }}
        hostUpdateState={{ status: 'downloaded', downloadedVersion: 'v1.1.0' }}
        onDownloadUpdate={() => {}}
        onScheduleUpdateOnExit={() => {}}
        onRestartAndApplyUpdate={() => {}}
        onOpenChangelog={() => {}}
      />,
    );
    expect(screen.getByText('Install update')).toBeInTheDocument();
  });

  it('ACTIONS_LIST contains expected actions', () => {
    expect(ACTIONS_LIST.length).toBeGreaterThan(0);
    expect(ACTIONS_LIST.some(a => a.id === 'settings')).toBe(true);
    expect(ACTIONS_LIST.some(a => a.id === 'toggleTheme')).toBe(true);
    expect(ACTIONS_LIST.find(a => a.id === 'workspaceSelection')?.scope).toBe('non-vscode');
    expect(ACTIONS_LIST.find(a => a.id === 'toggleDesktopViewMode')?.scope).toBe('electron');
    expect(ACTIONS_LIST.find(a => a.id === 'openCurrentDocumentLocation')?.scope).toBe('electron');
  });

});
