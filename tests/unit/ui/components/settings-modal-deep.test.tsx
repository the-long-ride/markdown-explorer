import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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
      documentConversion: true,
      desktopViewMode: 'focus',
      keybindings: { toggleTheme: 'Alt+T' },
      activeCustomThemeId: null,
      customThemes: [],
    },
    theme: 'dark',
    themeStyle: 'default',
    appVersion: '1.0.0',
    appRuntime: 'vscode',
    desktopFonts: [],
    desktopFontsResult: null,
    desktopFontError: null,
    recentWorkspaces: [],
    currentFile: '/docs/readme.md',
    sidebarCollapsed: false,
    tocCollapsed: true,
    toc: [{ id: 'h1', text: 'Hello', level: 1, children: [] }],
    focusMode: false,
    contentTabs: [],
    activeContentTabPath: null,
  };
}

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    dispatch: mockDispatch,
    setTheme: mockSetTheme,
    setThemeStyle: mockSetThemeStyle,
    updateSettings: mockUpdateSettings,
    openInEditor: vi.fn(),
    toggleToc: vi.fn(),
    toggleFocusMode: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mockPostMessage,
    onMessage: mockOnMessage,
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, tooltip, shortcut, label, onlyIcon = true, tooltipPos: _tooltipPos, tooltipAlign: _tooltipAlign, ...props }: any) => (
    <button onClick={onClick} aria-label={label || tooltip} data-shortcut={shortcut || undefined} {...props}>
      {icon}{!onlyIcon && label}{children}
      {tooltip && <span className="tooltip-text">{tooltip}</span>}
    </button>
  ),
}));

vi.mock('../../../../ui/src/components/Settings/ThemeStylePicker', () => ({
  ThemeStylePicker: ({ value, onChange, onOpenThemeRemix, showCustomThemes }: any) => (
    <div data-testid="theme-style-picker" data-value={value}>
      <button onClick={() => onChange('glass')}>change-style</button>
      <button onClick={onOpenThemeRemix}>open-remix</button>
      {showCustomThemes && <span data-testid="custom-themes-flag">has-custom</span>}
    </div>
  ),
}));

vi.mock('../../../../ui/src/components/Settings/ThemeRemixModal', () => ({
  ThemeRemixModal: ({ isOpen, onClose }: any) =>
    isOpen ? <div data-testid="theme-remix-modal"><button onClick={onClose}>close-remix</button></div> : null,
}));

vi.mock('../../../../ui/src/contexts/translations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
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
      closeSettings: 'Close Settings',
      typography: 'Typography',
      typographyDesc: 'Bind fonts by role.',
      updateBackup: 'Update & Backup',
      updateBackupDesc: 'Updates and portable settings.',
      applicationUpdate: 'Application update',
      checkForUpdate: 'Check for update',
      latestVersionStatus: 'Latest version',
      newerVersionStatus: 'New version',
      settingsBackup: 'Settings backup',
      settingsBackupDesc: 'Import or export settings.',
      actions: {
        ...en.actions,
        findCurrentFile: 'Find in file',
        searchCurrent: 'Search workspace',
        searchAllTabs: 'Search all tabs',
        back: 'Back',
        forward: 'Forward',
        welcome: 'Welcome',
        editCurrentDocument: 'Open current file in editor',
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
        sidebarCursorMode: 'Sidebar cursor',
      },
      tooltips: {
        ...en.tooltips,
        switchLanguage: 'Switch Language',
        openChangelog: 'Open changelog',
        closeModal: 'Close modal [Esc]',
        minimize: 'Minimize',
        maximize: 'Maximize',
        restore: 'Restore',
        closeApp: 'Close',
        close: 'Close',
        previous: 'Previous',
        next: 'Next',
        zoomIn: 'Zoom In',
        zoomOut: 'Zoom Out',
        resetZoom: 'Reset Zoom',
      },
      settingsData: {
        ...en.settingsData,
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
        ...en.update,
        availableTitle: 'New version {version}',
        availableDescription: 'Current version {version}.',
        viewChangelog: 'see changelog',
        downloadButton: 'Download',
        downloading: 'Downloading... {progress}%',
        applying: 'Applying...',
        scheduled: 'Scheduled.',
        updateOnExit: 'Update when I close',
        restartAndUpdate: 'Restart now',
        restartPromptTitle: 'Install update',
        restartPromptBody: 'Version {version} ready.',
        downloadFailed: 'Download failed.',
        installFailed: 'Install failed.',
        stagedMissing: 'Staged missing.',
      },
      bannedShortcutTitle: 'Banned Shortcut',
      bannedShortcutDismiss: 'Dismiss',
      bannedShortcutImeMessage: 'Ctrl+Space is IME.',
      resetShortcutsConfirmTitle: 'Reset keyboard shortcuts?',
      resetShortcutsConfirmBody: 'Confirm reset',
      confirmResetShortcuts: 'Reset Shortcuts',
      cancelResetShortcuts: 'Cancel',
      themeStyles: {
        ...en.themeStyles,
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
      { id: 'ja', label: '日本語' },
    ],
  };
});

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CopyIcon: () => <span>copy-icon</span>,
  FolderIcon: () => <span>folder-icon</span>,
  AlertTriangleIcon: ({ size }: any) => <span>alert-icon</span>,
  ImportSettingsIcon: () => <span>import-icon</span>,
  ExportSettingsIcon: () => <span>export-icon</span>,
  CheckForUpdateIcon: () => <span>update-icon</span>,
  SettingsAppearanceIcon: () => <span>appearance-icon</span>,
  SettingsTypographyIcon: () => <span>typography-icon</span>,
  SettingsThemeStyleIcon: () => <span>theme-style-icon</span>,
  SettingsShortcutsIcon: () => <span>shortcuts-icon</span>,
  SettingsUpdateBackupIcon: () => <span>update-backup-icon</span>,
  RefreshIcon: () => <span>refresh-icon</span>,
  OpenInBrowserIcon: () => <span>browser-icon</span>,
  LanguageIcon: () => <span>lang-icon</span>,
}));

vi.mock('../../../../ui/src/contexts/appStateConstants', () => ({
  THEME_MODE_OPTIONS: [
    { id: 'auto', label: 'Auto' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ],
  getDefaultKeybindings: () => ({ searchCurrent: 'Ctrl+K', editCurrentDocument: 'Ctrl+Alt+E' }),
  getDefaultKeybindingsForRuntime: (runtime: string) => runtime === 'chrome' ? { searchCurrent: 'Ctrl+K' } : { searchCurrent: 'Ctrl+K', editCurrentDocument: runtime === 'vscode' ? 'Ctrl+Alt+E' : 'Ctrl+E' },
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

vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/*.png', () => ({
  default: 'mock-blep.png',
}));

import { SettingsModal, ACTIONS_LIST } from '../../../../ui/src/components/Settings/SettingsModal';

function renderModal(overrides: Record<string, any> = {}) {
  return render(
    <SettingsModal
      isOpen={true}
      onClose={overrides.onClose || vi.fn()}
      updateCheck={overrides.updateCheck || defaultUpdateCheck}
      hostUpdateState={overrides.hostUpdateState || defaultHostUpdateState}
      onDownloadUpdate={overrides.onDownloadUpdate || vi.fn()}
      onScheduleUpdateOnExit={overrides.onScheduleUpdateOnExit || vi.fn()}
      onRestartAndApplyUpdate={overrides.onRestartAndApplyUpdate || vi.fn()}
      onOpenChangelog={overrides.onOpenChangelog || vi.fn()}
    />
  );
}

function openSection(label: string) {
  fireEvent.click(screen.getByText(label));
}

afterEach(() => {
  delete (window as any).electronAPI;
});

describe('SettingsModal deep', () => {
  beforeEach(() => {
    mockState = getMockState();
    mockDispatch.mockClear();
    mockSetTheme.mockClear();
    mockSetThemeStyle.mockClear();
    mockUpdateSettings.mockClear();
    mockPostMessage.mockClear();
  });

  describe('open/close behavior', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <SettingsModal
          isOpen={false}
          onClose={vi.fn()}
          updateCheck={defaultUpdateCheck}
          hostUpdateState={defaultHostUpdateState}
          onDownloadUpdate={vi.fn()}
          onScheduleUpdateOnExit={vi.fn()}
          onRestartAndApplyUpdate={vi.fn()}
          onOpenChangelog={vi.fn()}
        />
      );
      expect(container.innerHTML).toBe('');
    });

    it('renders dialog when isOpen is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('close button calls onClose', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Close Settings' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('clicking backdrop calls onClose', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('dialog'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('language picker', () => {
    it('opens language menu on button click', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      expect(screen.getByRole('listbox', { name: 'Languages' })).toBeInTheDocument();
    });

    it('lists all language options', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Tiếng Việt')).toBeInTheDocument();
      expect(screen.getByText('日本語')).toBeInTheDocument();
    });

    it('marks current language as selected', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      const enOption = screen.getByRole('option', { selected: true });
      expect(enOption).toHaveTextContent('English');
    });

    it('calls updateSettings on language change', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      fireEvent.click(screen.getByText('日本語'));
      expect(mockUpdateSettings).toHaveBeenCalledWith({ language: 'ja' });
    });

    it('closes language menu on language selection', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      fireEvent.click(screen.getByText('日本語'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes language menu on outside click', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes language menu on Escape key', () => {
      renderModal();
      const langBtn = document.querySelector('.settings-language-btn') as HTMLElement;
      fireEvent.click(langBtn);
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('keybinding customization', () => {
    it('renders shortcut input for each visible action', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('shows Press keys... when input is focused (recording)', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      expect(inputs[0].value).toBe('Press keys…');
    });

    it('records Ctrl+K shortcut and calls updateSettings', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: 'k', ctrlKey: true });
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ keybindings: expect.any(Object) })
      );
    });

    it('records Shift+Alt+A shortcut', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: 'a', shiftKey: true, altKey: true });
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    it('rejects a shortcut already assigned to another command', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: 't', altKey: true });
      expect(screen.getByText('Banned Shortcut')).toBeInTheDocument();
      expect(mockUpdateSettings).not.toHaveBeenCalled();
    });

    it('disables a shortcut from its switch', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const shortcutSwitch = screen.getAllByRole('switch')[0];
      expect(shortcutSwitch).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(shortcutSwitch);
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        disabledKeybindings: expect.objectContaining({ welcome: true }),
      });
    });

    it('rejects Ctrl+Space as banned shortcut', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: ' ', ctrlKey: true });
      expect(screen.getByText('Banned Shortcut')).toBeInTheDocument();
    });

    it('banned shortcut dialog dismiss button clears error', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: ' ', ctrlKey: true });
      fireEvent.click(screen.getByText('Dismiss'));
      expect(screen.queryByText('Banned Shortcut')).not.toBeInTheDocument();
    });

    it('clicking backdrop on banned shortcut dialog clears error', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: ' ', ctrlKey: true });
      const bannedDialog = screen.getAllByRole('dialog')[1];
      fireEvent.click(bannedDialog);
      expect(screen.queryByText('Banned Shortcut')).not.toBeInTheDocument();
    });

    it('ignores standalone modifier keys', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: 'Control' });
      expect(mockUpdateSettings).not.toHaveBeenCalled();
    });

    it('shortcut recording stops after key is recorded', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: 'k', ctrlKey: true });
      expect(inputs[0].value).not.toBe('Press keys…');
    });

    it('Reset to Default Shortcuts calls updateSettings with defaults', () => {
      renderModal();
      openSection('Keyboard Shortcuts');
      fireEvent.click(screen.getByText('Reset to Default Shortcuts'));
      fireEvent.click(screen.getByRole('button', { name: 'Reset Shortcuts' }));
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        keybindings: { searchCurrent: 'Ctrl+K', editCurrentDocument: 'Ctrl+Alt+E' },
        disabledKeybindings: {},
      });
    });
  });

  describe('theme mode', () => {
    it('renders three color mode options', () => {
      renderModal();
      expect(screen.getByText('Auto')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    it('clicking Light calls setTheme with light', () => {
      renderModal();
      fireEvent.click(screen.getByText('Light'));
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('clicking Dark calls setTheme with dark', () => {
      renderModal();
      fireEvent.click(screen.getByText('Dark'));
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('clicking Auto calls setTheme with auto', () => {
      renderModal();
      fireEvent.click(screen.getByText('Auto'));
      expect(mockSetTheme).toHaveBeenCalledWith('auto');
    });

    it('marks current theme as active', () => {
      mockState = { ...getMockState(), theme: 'light' };
      renderModal();
      const lightBtn = screen.getByText('Light');
      expect(lightBtn.classList.contains('is-active')).toBe(true);
    });
  });

  describe('theme style', () => {
    it('renders ThemeStylePicker component', () => {
      renderModal();
      openSection('Theme Style');
      expect(screen.getByTestId('theme-style-picker')).toBeInTheDocument();
    });

    it('calls setThemeStyle when style picker onChange fires', () => {
      renderModal();
      openSection('Theme Style');
      fireEvent.click(screen.getByText('change-style'));
      expect(mockSetThemeStyle).toHaveBeenCalledWith('glass');
    });

    it('opens ThemeRemixModal when open-remix is clicked', () => {
      renderModal();
      openSection('Theme Style');
      fireEvent.click(screen.getByText('open-remix'));
      expect(screen.getByTestId('theme-remix-modal')).toBeInTheDocument();
    });

    it('closes ThemeRemixModal on close-remix click', () => {
      renderModal();
      openSection('Theme Style');
      fireEvent.click(screen.getByText('open-remix'));
      expect(screen.getByTestId('theme-remix-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('close-remix'));
      expect(screen.queryByTestId('theme-remix-modal')).not.toBeInTheDocument();
    });
  });

  describe('desktop view mode toggle', () => {
    it('renders Desktop View section in electron mode', () => {
      (window as any).electronAPI = {};
      renderModal();
      expect(screen.getByText('Desktop View')).toBeInTheDocument();
      delete (window as any).electronAPI;
    });

    it('clicking Focus mode calls updateSettings', () => {
      (window as any).electronAPI = {};
      renderModal();
      const focusBtn = screen.getByText('Focus');
      fireEvent.click(focusBtn);
      expect(mockUpdateSettings).toHaveBeenCalledWith({ desktopViewMode: 'focus' });
      delete (window as any).electronAPI;
    });

    it('clicking Tabs mode calls updateSettings', () => {
      (window as any).electronAPI = {};
      renderModal();
      const tabsBtn = screen.getByText('Tabs');
      fireEvent.click(tabsBtn);
      expect(mockUpdateSettings).toHaveBeenCalledWith({ desktopViewMode: 'tabs' });
      delete (window as any).electronAPI;
    });

    it('does not render Desktop View when not desktop', () => {
      renderModal();
      expect(screen.queryByText('Desktop View')).not.toBeInTheDocument();
    });
  });

  describe('file tabs toggle', () => {
    it('renders File Tabs toggle', () => {
      renderModal();
      expect(screen.getByText('File Tabs')).toBeInTheDocument();
    });

    it('toggling fileTabs checkbox calls updateSettings', () => {
      renderModal();
      const checkboxes = screen.getAllByRole('checkbox');
      const fileTabsCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('File Tabs'));
      if (fileTabsCheckbox) {
        fireEvent.click(fileTabsCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ fileTabs: !mockState.settings.fileTabs });
      }
    });
  });

  describe('showTitle / sidebar labels toggle', () => {
    it('renders Sidebar Labels toggle', () => {
      renderModal();
      expect(screen.getByText('Sidebar Labels')).toBeInTheDocument();
    });

    it('toggling showTitle checkbox calls updateSettings', () => {
      renderModal();
      const checkboxes = screen.getAllByRole('checkbox');
      const showTitleCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('Sidebar Labels'));
      if (showTitleCheckbox) {
        fireEvent.click(showTitleCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ showTitle: !mockState.settings.showTitle });
      }
    });
  });

  describe('document conversion toggle', () => {
    it('renders Document Conversion in electron mode', () => {
      (window as any).electronAPI = {};
      renderModal();
      expect(screen.getByText('Document Conversion')).toBeInTheDocument();
      delete (window as any).electronAPI;
    });

    it('toggling documentConversion calls updateSettings', () => {
      (window as any).electronAPI = {};
      renderModal();
      const checkboxes = screen.getAllByRole('checkbox');
      const docConvCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('Document Conversion'));
      if (docConvCheckbox) {
        fireEvent.click(docConvCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ documentConversion: !mockState.settings.documentConversion });
      }
      delete (window as any).electronAPI;
    });

    it('does not render Document Conversion when not desktop', () => {
      renderModal();
      expect(screen.queryByText('Document Conversion')).not.toBeInTheDocument();
    });
  });

  describe('HTML Preview toggle', () => {
    it('renders HTML Preview toggle', () => {
      renderModal();
      expect(screen.getByText('HTML Preview')).toBeInTheDocument();
    });

    it('toggling defaultHtmlPreview calls updateSettings', () => {
      renderModal();
      const checkboxes = screen.getAllByRole('checkbox');
      const htmlPreviewCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('HTML Preview'));
      if (htmlPreviewCheckbox) {
        fireEvent.click(htmlPreviewCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultHtmlPreview: !mockState.settings.defaultHtmlPreview });
      }
    });
  });

  describe('CSV Preview toggle', () => {
    it('renders the CSV preview preference description in the portal on hover', () => {
      renderModal();
      expect(screen.getByText('CSV Preview')).toBeInTheDocument();
      const row = screen.getByText('CSV Preview').closest('.settings-preference-row');
      expect(row).not.toBeNull();
      expect(row?.querySelector('.settings-preference-description-panel')).toBeNull();

      fireEvent.mouseEnter(row!);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('CSV preview default.');
      expect(tooltip.parentElement).toBe(document.body);
    });

    it('updates the independent CSV preview preference', () => {
      renderModal();
      const csvRow = screen.getByText('CSV Preview').closest('.settings-preference-row');
      const checkbox = csvRow?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      expect(checkbox).not.toBeNull();
      fireEvent.click(checkbox!);
      expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultCsvPreview: true });
    });
  });

  describe('import/export settings', () => {
    it('renders Import JSON button with the shared tooltip', () => {
      (window as any).electronAPI = {};
      renderModal();
      openSection('Update & Backup');
      const button = screen.getByRole('button', { name: 'Import JSON' });
      expect(button).toBeInTheDocument();
      expect(button.querySelector('.tooltip-text')).toHaveTextContent('Import JSON');
    });

    it('renders Export JSON button with the shared tooltip', () => {
      (window as any).electronAPI = {};
      renderModal();
      openSection('Update & Backup');
      const button = screen.getByRole('button', { name: 'Export JSON' });
      expect(button).toBeInTheDocument();
      expect(button.querySelector('.tooltip-text')).toHaveTextContent('Export JSON');
    });

    it('export button creates downloadable blob and shows status', () => {
      (window as any).electronAPI = {};
      renderModal();
      openSection('Update & Backup');
      const exportBtn = screen.getByRole('button', { name: 'Export JSON' });
      fireEvent.click(exportBtn);
      expect(screen.getByRole('status')).toHaveTextContent('Settings exported.');
    });

    it('import with invalid file shows error status', async () => {
      (window as any).electronAPI = {};
      renderModal();
      openSection('Update & Backup');
      const importInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['invalid'], 'settings.json', { type: 'application/json' });
      Object.defineProperty(importInput, 'files', { value: [file], configurable: true });
      fireEvent.change(importInput);
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Import failed.');
      });
    });
  });

  describe('update check section', () => {
    it('renders update card when update available', () => {
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('renders download progress when downloading', () => {
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloading', progressPercent: 50 },
      });
      openSection('Update & Backup');
      expect(screen.getByText(/Downloading/)).toBeInTheDocument();
    });

    it('renders scheduled text when update is scheduled', () => {
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'scheduled-on-exit' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('Scheduled.')).toBeInTheDocument();
    });

    it('renders applying text when update is applying', () => {
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'applying' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('Applying...')).toBeInTheDocument();
    });

    it('renders error text when download fails', () => {
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'error', error: 'download-failed' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('download-failed')).toBeInTheDocument();
    });

    it('renders install error for non-download errors', () => {
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'error', error: 'some-install-error' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('some-install-error')).toBeInTheDocument();
    });

    it('renders staged missing error', () => {
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'error', error: 'missing-staged-update' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('missing-staged-update')).toBeInTheDocument();
    });

    it('download button calls onDownloadUpdate', () => {
      const onDownloadUpdate = vi.fn();
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: defaultHostUpdateState,
        onDownloadUpdate,
      });
      openSection('Update & Backup');
      fireEvent.click(screen.getByText('Download'));
      expect(onDownloadUpdate).toHaveBeenCalled();
    });

    it('view changelog calls onOpenChangelog', () => {
      const onOpenChangelog = vi.fn();
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: defaultHostUpdateState,
        onOpenChangelog,
      });
      openSection('Update & Backup');
      fireEvent.click(screen.getAllByText('see changelog')[0]);
      expect(onOpenChangelog).toHaveBeenCalled();
    });
  });

  describe('downloaded update restart dialog', () => {
    it('shows restart dialog when update is downloaded', () => {
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloaded', downloadedVersion: 'v1.1.0' },
      });
      openSection('Update & Backup');
      expect(screen.getByText('Install update')).toBeInTheDocument();
    });

    it('uses Restart now as the primary action and Update when I close as the deferred action', () => {
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloaded', downloadedVersion: 'v1.1.0' },
      });
      openSection('Update & Backup');
      expect(screen.getByRole('button', { name: 'Restart now' })).toHaveClass('settings-update-dialog__restart');
      expect(screen.getByRole('button', { name: 'Update when I close' })).toHaveClass('settings-update-dialog__defer');
    });

    it('Update when I close button calls onScheduleUpdateOnExit', () => {
      const onScheduleUpdateOnExit = vi.fn();
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloaded', downloadedVersion: 'v1.1.0' },
        onScheduleUpdateOnExit,
      });
      openSection('Update & Backup');
      fireEvent.click(screen.getByText('Update when I close'));
      expect(onScheduleUpdateOnExit).toHaveBeenCalled();
    });

    it('Restart now button calls onRestartAndApplyUpdate', () => {
      const onRestartAndApplyUpdate = vi.fn();
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloaded', downloadedVersion: 'v1.1.0' },
        onRestartAndApplyUpdate,
      });
      openSection('Update & Backup');
      fireEvent.click(screen.getByText('Restart now'));
      expect(onRestartAndApplyUpdate).toHaveBeenCalled();
    });
  });

  describe('version label', () => {
    it('renders formatted version from updateCheck', () => {
      renderModal({
        updateCheck: { ...defaultUpdateCheck, currentVersion: 'v2.3.4' },
      });
      expect(screen.getByText('v2.3.4')).toBeInTheDocument();
    });

    it('falls back to appVersion when no currentVersion', () => {
      mockState = { ...getMockState(), appVersion: '3.0.0' };
      renderModal();
      expect(screen.getByText('v3.0.0')).toBeInTheDocument();
    });

    it('clicking version link calls onOpenChangelog', () => {
      const onOpenChangelog = vi.fn();
      renderModal({
        updateCheck: { ...defaultUpdateCheck, currentVersion: 'v1.0.0' },
        onOpenChangelog,
      });
      fireEvent.click(screen.getByText('v1.0.0'));
      expect(onOpenChangelog).toHaveBeenCalled();
    });
  });

  describe('visibility of update card', () => {
    it('does not show update card when no update available', () => {
      renderModal();
      expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });

    it('shows update card when downloading', () => {
      mockState = { ...getMockState(), appRuntime: 'desktop' };
      (window as any).electronAPI = {};
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloading', progressPercent: 30 },
      });
      openSection('Update & Backup');
      expect(document.querySelector('.settings-update-overview')).toBeInTheDocument();
    });

    it('hides download button when downloading', () => {
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloading', progressPercent: 30 },
      });
      expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });

    it('hides download button when update is downloaded', () => {
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'downloaded', downloadedVersion: 'v1.1.0' },
      });
      expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });

    it('hides download button when update is scheduled', () => {
      renderModal({
        updateCheck: { status: 'available', hasUpdate: true, currentVersion: 'v1.0.0', latestVersion: 'v1.1.0', changelogUrl: '#' },
        hostUpdateState: { status: 'scheduled-on-exit' },
      });
      expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });
  });

  describe('ACTIONS_LIST', () => {
    it('contains expected number of actions', () => {
      expect(ACTIONS_LIST.length).toBe(31);
    });

    it('contains toggleWorkspaceInsights action', () => {
      expect(ACTIONS_LIST.find(a => a.id === 'toggleWorkspaceInsights')).toBeDefined();
    });

    it('contains findCurrentFile action', () => {
      expect(ACTIONS_LIST.find(a => a.id === 'findCurrentFile')).toBeDefined();
    });

    it('contains toggleFocusMode action', () => {
      expect(ACTIONS_LIST.find(a => a.id === 'toggleFocusMode')).toBeDefined();
    });

    it('scopes open current document location to desktop apps', () => {
      expect(ACTIONS_LIST.find(a => a.id === 'openCurrentDocumentLocation')?.scope).toBe('electron');
    });
  });

  describe('pet theme mascot in banned shortcut dialog', () => {
    it('shows mascot when themeStyle starts with pet-', () => {
      mockState = { ...getMockState(), themeStyle: 'pet-white-shiba' };
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: ' ', ctrlKey: true });
      const img = document.querySelector('.banned-shortcut-mascot img');
      expect(img).toBeInTheDocument();
    });

    it('shows alert icon when themeStyle is not pet- style', () => {
      mockState = { ...getMockState(), themeStyle: 'default' };
      renderModal();
      openSection('Keyboard Shortcuts');
      const inputs = document.querySelectorAll('.settings-shortcut-input') as NodeListOf<HTMLInputElement>;
      fireEvent.focus(inputs[0]);
      fireEvent.keyDown(inputs[0], { key: ' ', ctrlKey: true });
      const icon = document.querySelector('.banned-shortcut-icon');
      expect(icon).toBeInTheDocument();
    });
  });

});
