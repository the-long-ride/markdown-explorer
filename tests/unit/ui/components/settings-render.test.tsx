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
    appRuntime: 'vscode',
    currentFile: '/workspace/readme.md',
    desktopFonts: [],
    desktopFontsResult: null,
    desktopFontError: null,
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
  usePlatform: () => ({
    postMessage: mockPostMessage,
    onMessage: mockOnMessage,
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  }),
}));

vi.mock('../../../../ui/src/components/Settings/SettingsFeaturesIcon', () => ({
  SettingsFeaturesIcon: () => <span>features-icon</span>,
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, tooltip, label, onlyIcon = true, ...props }: any) => (
    <button onClick={onClick} aria-label={label || tooltip} {...props}>
      {icon}{!onlyIcon && label}{children}
    </button>
  ),
}));

vi.mock('../../../../ui/src/components/Settings/ThemeStylePicker', () => ({
  ThemeStylePicker: () => <div data-testid="theme-style-picker" />,
}));

vi.mock('../../../../ui/src/components/Settings/ThemeRemixModal', () => ({
  ThemeRemixModal: () => null,
}));

vi.mock('../../../../ui/src/contexts/translations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
      settings: 'Settings',
      subtitle: 'Customize',
      appearance: 'Appearance',
      features: 'Features',
      sidebarLabels: 'Sidebar Labels',
      fileTabs: 'File Tabs',
      htmlPreview: 'HTML Preview',
      csvPreview: 'CSV Preview',
      documentConversion: 'Document Conversion',
      closeSettings: 'Close Settings',
      shortcuts: 'Keyboard Shortcuts',
      themeStyle: 'Theme Style',
      typography: 'Typography',
      updateBackup: 'Update & Backup',
    }),
  };
});

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CopyIcon: () => <span>copy</span>,
  FolderIcon: () => <span>folder</span>,
  AlertTriangleIcon: () => <span>alert</span>,
  ImportSettingsIcon: () => <span>import</span>,
  ExportSettingsIcon: () => <span>export</span>,
  CheckForUpdateIcon: () => <span>update</span>,
  SettingsAppearanceIcon: () => <span>appearance-icon</span>,
  SettingsTypographyIcon: () => <span>typography-icon</span>,
  SettingsThemeStyleIcon: () => <span>theme-style-icon</span>,
  SettingsShortcutsIcon: () => <span>shortcuts-icon</span>,
  SettingsUpdateBackupIcon: () => <span>update-backup-icon</span>,
  SettingsFeaturesIcon: () => <span>features-icon</span>,
  RefreshIcon: () => <span>refresh</span>,
  OpenInBrowserIcon: () => <span>browser</span>,
  LanguageIcon: () => <span>lang</span>,
}));

vi.mock('../../../../ui/src/contexts/appStateConstants', () => ({
  THEME_MODE_OPTIONS: [
    { id: 'auto', label: 'Auto' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ],
  getDefaultKeybindings: () => ({}),
  getDefaultKeybindingsForRuntime: () => ({}),
}));

vi.mock('../../../../ui/src/settings/settingsImportExport', () => ({
  SettingsImportError: class SettingsImportError extends Error {},
  createSettingsExport: () => '{}',
  parseSettingsImport: () => { throw new Error('Invalid'); },
  restoreLocalUiSettings: () => {},
}));

vi.mock('../../../../ui/src/utils/shortcuts', () => ({
  formatShortcutLabel: (s: string) => s,
  getEnabledShortcut: () => null,
}));

vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/*.png', () => ({
  default: 'mock.png',
}));

describe('SettingsModal render', () => {
  beforeEach(() => {
    mockState = getMockState();
    mockDispatch.mockClear();
    mockUpdateSettings.mockClear();
  });

  it('renders dialog when open', () => {
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

  it('renders Features navigation item', () => {
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
    expect(screen.getByText('Features')).toBeInTheDocument();
  });

  it('renders Sidebar Labels toggle under Features', () => {
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
    fireEvent.click(screen.getByText('Features'));
    expect(screen.getByText('Sidebar Labels')).toBeInTheDocument();
  });

  it('renders File Tabs toggle under Features', () => {
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
    fireEvent.click(screen.getByText('Features'));
    expect(screen.getByText('File Tabs')).toBeInTheDocument();
  });

  it('renders HTML Preview toggle under Features', () => {
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
    fireEvent.click(screen.getByText('Features'));
    expect(screen.getByText('HTML Preview')).toBeInTheDocument();
  });

  it('renders CSV Preview toggle under Features', () => {
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
    fireEvent.click(screen.getByText('Features'));
    expect(screen.getByText('CSV Preview')).toBeInTheDocument();
  });

  it('exposes ACTIONS_LIST with expected scopes', () => {
    expect(ACTIONS_LIST.length).toBeGreaterThan(0);
    expect(ACTIONS_LIST.some(a => a.id === 'settings')).toBe(true);
  });
});
