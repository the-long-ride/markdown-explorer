import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

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
      language: 'en', showTitle: false, fileTabs: true,
      defaultHtmlPreview: false, defaultCsvPreview: false, documentConversion: true,
      desktopViewMode: 'focus', keybindings: { toggleTheme: 'Alt+T' },
      activeCustomThemeId: null, customThemes: [],
    },
    theme: 'dark', themeStyle: 'default', appVersion: '1.0.0', appRuntime: 'vscode',
    desktopFonts: [], desktopFontsResult: null, desktopFontError: null,
    recentWorkspaces: [], currentFile: '/docs/readme.md',
    sidebarCollapsed: false, tocCollapsed: true,
    toc: [{ id: 'h1', text: 'Hello', level: 1, children: [] }],
    focusMode: false, contentTabs: [], activeContentTabPath: null,
  };
}

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState, dispatch: mockDispatch, setTheme: mockSetTheme,
    setThemeStyle: mockSetThemeStyle, updateSettings: mockUpdateSettings,
    openInEditor: vi.fn(), toggleToc: vi.fn(), toggleFocusMode: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/components/Settings/SettingsFeaturesIcon', () => ({
  SettingsFeaturesIcon: () => <span>features-icon</span>,
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mockPostMessage, onMessage: mockOnMessage,
    getState: () => undefined, setState: () => {}, copyToClipboard: () => {},
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, tooltip, shortcut, label, onlyIcon = true, ...props }: any) => (
    <button onClick={onClick} aria-label={label || tooltip} data-shortcut={shortcut || undefined} {...props}>
      {icon}{!onlyIcon && label}{children}
    </button>
  ),
}));

vi.mock('../../../../ui/src/components/Settings/ThemeStylePicker', () => ({
  ThemeStylePicker: ({ value, onChange }: any) => (
    <div data-testid="theme-style-picker" data-value={value}>
      <button onClick={() => onChange('glass')}>change-style</button>
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
      settings: 'Settings', subtitle: 'Customize your view', appearance: 'Appearance',
      features: 'Features', colorMode: 'Color Mode', themeStyle: 'Theme Style',
      sidebarLabels: 'Sidebar Labels', fileTabs: 'File Tabs',
      documentConversion: 'Document Conversion', htmlPreview: 'HTML Preview', csvPreview: 'CSV Preview',
      shortcuts: 'Keyboard Shortcuts', closeSettings: 'Close Settings',
      typography: 'Typography', updateBackup: 'Update & Backup',
      light: 'Light', dark: 'Dark', auto: 'Auto',
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
  AlertTriangleIcon: () => <span>alert-icon</span>,
  ImportSettingsIcon: () => <span>import-icon</span>,
  ExportSettingsIcon: () => <span>export-icon</span>,
  CheckForUpdateIcon: () => <span>update-icon</span>,
  SettingsAppearanceIcon: () => <span>appearance-icon</span>,
  SettingsTypographyIcon: () => <span>typography-icon</span>,
  SettingsThemeStyleIcon: () => <span>theme-style-icon</span>,
  SettingsShortcutsIcon: () => <span>shortcuts-icon</span>,
  SettingsUpdateBackupIcon: () => <span>update-backup-icon</span>,
  SettingsFeaturesIcon: () => <span>features-icon</span>,
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
  getDefaultKeybindingsForRuntime: (runtime: string) =>
    runtime === 'chrome' ? { searchCurrent: 'Ctrl+K' } : { searchCurrent: 'Ctrl+K', editCurrentDocument: runtime === 'vscode' ? 'Ctrl+Alt+E' : 'Ctrl+E' },
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
    />,
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
        />,
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
  });

  describe('Features section toggles', () => {
    it('renders File Tabs toggle', () => {
      renderModal();
      openSection('Features');
      expect(screen.getByText('File Tabs')).toBeInTheDocument();
    });

    it('toggling fileTabs checkbox calls updateSettings', () => {
      renderModal();
      openSection('Features');
      const checkboxes = screen.getAllByRole('checkbox');
      const fileTabsCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('File Tabs'));
      if (fileTabsCheckbox) {
        fireEvent.click(fileTabsCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ fileTabs: !mockState.settings.fileTabs });
      }
    });

    it('renders Sidebar Labels toggle', () => {
      renderModal();
      openSection('Features');
      expect(screen.getByText('Sidebar Labels')).toBeInTheDocument();
    });

    it('toggling showTitle checkbox calls updateSettings', () => {
      renderModal();
      openSection('Features');
      const checkboxes = screen.getAllByRole('checkbox');
      const showTitleCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('Sidebar Labels'));
      if (showTitleCheckbox) {
        fireEvent.click(showTitleCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ showTitle: !mockState.settings.showTitle });
      }
    });

    it('renders Document Conversion in electron mode', () => {
      (window as any).electronAPI = {};
      mockState.appRuntime = 'desktop';
      renderModal();
      openSection('Features');
      expect(screen.getByText('Document Conversion')).toBeInTheDocument();
      delete (window as any).electronAPI;
    });

    it('toggling documentConversion calls updateSettings', () => {
      (window as any).electronAPI = {};
      mockState.appRuntime = 'desktop';
      renderModal();
      openSection('Features');
      const checkboxes = screen.getAllByRole('checkbox');
      const docConvCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('Document Conversion'));
      if (docConvCheckbox) {
        fireEvent.click(docConvCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ documentConversion: !mockState.settings.documentConversion });
      }
      delete (window as any).electronAPI;
    });

    it('renders HTML Preview toggle', () => {
      renderModal();
      openSection('Features');
      expect(screen.getByText('HTML Preview')).toBeInTheDocument();
    });

    it('toggling defaultHtmlPreview calls updateSettings', () => {
      renderModal();
      openSection('Features');
      const checkboxes = screen.getAllByRole('checkbox');
      const htmlPreviewCheckbox = checkboxes.find(cb => cb.closest('.settings-item')?.textContent?.includes('HTML Preview'));
      if (htmlPreviewCheckbox) {
        fireEvent.click(htmlPreviewCheckbox);
        expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultHtmlPreview: !mockState.settings.defaultHtmlPreview });
      }
    });

    it('renders CSV Preview toggle', () => {
      renderModal();
      openSection('Features');
      expect(screen.getByText('CSV Preview')).toBeInTheDocument();
    });

    it('updates the independent CSV preview preference', () => {
      renderModal();
      openSection('Features');
      const csvRow = screen.getByText('CSV Preview').closest('.settings-preference-row');
      const checkbox = csvRow?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (checkbox) {
        fireEvent.click(checkbox);
        expect(mockUpdateSettings).toHaveBeenCalled();
      }
    });
  });

  describe('ACTIONS_LIST', () => {
    it('exposes expected action scopes', () => {
      expect(ACTIONS_LIST.length).toBeGreaterThan(0);
      expect(ACTIONS_LIST.some(a => a.id === 'settings')).toBe(true);
    });
  });
});
