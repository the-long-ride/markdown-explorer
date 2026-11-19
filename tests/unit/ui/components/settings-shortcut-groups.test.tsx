import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsShortcutsPanel } from '../../../../ui/src/components/Settings/SettingsShortcutsPanel';
import { SettingsModal } from '../../../../ui/src/components/Settings/SettingsModal';
import { ACTIONS_LIST } from '../../../../ui/src/components/Settings/settingsActions';

const mockUpdateSettings = vi.fn();
let mockState: any;

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
      keybindings: {
        toggleSidebar: 'Ctrl+B',
        toggleTheme: 'Ctrl+L',
        searchCurrent: 'Ctrl+K',
        editCurrentDocument: 'Ctrl+E',
        editorBold: 'Ctrl+B',
        editorItalic: 'Ctrl+I',
        editorQuote: 'Ctrl+Shift+Q',
      },
      disabledKeybindings: {},
      activeCustomThemeId: null,
      customThemes: [],
    },
    theme: 'dark',
    themeStyle: 'default',
    appVersion: '1.0.0',
    appRuntime: 'desktop',
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
    dispatch: vi.fn(),
    setTheme: vi.fn(),
    setThemeStyle: vi.fn(),
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  }),
}));

function getShortcutInputForAction(actionTitle: string): HTMLInputElement {
  const row = screen.getByText(actionTitle).closest('.settings-shortcut-row');
  if (!row) throw new Error(`Could not find shortcut row for "${actionTitle}"`);
  const input = row.querySelector('input.settings-shortcut-input');
  if (!input) throw new Error(`Could not find shortcut input for "${actionTitle}"`);
  return input as HTMLInputElement;
}

const defaultUpdateCheck = { status: 'idle' as const, currentVersion: '1.0.0', latestVersion: '1.0.0', hasUpdate: false, changelogUrl: '' };
const defaultHostUpdateState = { status: 'idle' as const };

function renderModal() {
  return render(
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
}

describe('Settings shortcut groups', () => {
  beforeEach(() => {
    (window as any).electronAPI = {};
    mockState = getMockState();
    mockUpdateSettings.mockClear();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('shows the matching shortcut under its mission label with its runtime scope', () => {
    const save = ACTIONS_LIST.find((action) => action.id === 'saveCurrentDocument')!;
    const onRequestReset = vi.fn();
    render(
      <SettingsShortcutsPanel
        state={{ settings: { language: 'en', keybindings: { saveCurrentDocument: 'Ctrl+S' }, disabledKeybindings: {} } } as any}
        t={{ shortcuts: 'Keyboard shortcuts', shortcutsHint: 'Customize shortcuts', resetShortcuts: 'Reset', ui: { shortcutSearchPlaceholder: 'Search', shortcutSearchLabel: 'Search shortcuts', shortcutSearchClear: 'Clear', shortcutDisable: 'Disable {action}', shortcutEnable: 'Enable {action}', shortcutRecordPlaceholder: 'Record', shortcutPressKeys: 'Press keys' } }}
        isDesktop
        shortcutSearchQuery="save"
        setShortcutSearchQuery={vi.fn()}
        filteredActions={[save]}
        actionLabels={{ saveCurrentDocument: 'Save current document' }}
        recordingAction={null}
        setRecordingAction={vi.fn()}
        handleKeyDown={vi.fn()}
        updateSettings={vi.fn()}
        onRequestReset={onRequestReset}
      />,
    );

    const group = screen.getByRole('group', { name: 'Document' });
    expect(within(group).getByText('Save current document')).toBeInTheDocument();
    expect(within(group).getByText('All apps')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Search' })).not.toBeInTheDocument();
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset.closest('.settings-shortcuts__header')).not.toBeNull();
    expect(reset.querySelector('svg')).not.toBeNull();
    fireEvent.click(reset);
    expect(onRequestReset).toHaveBeenCalledOnce();
  });

  it('renders the Markdown Editor shortcut group in Settings > Keyboard Shortcuts', () => {
    renderModal();
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    const editorGroup = screen.getByRole('group', { name: 'Markdown Editor' });
    expect(editorGroup).toBeInTheDocument();

    expect(within(editorGroup).getByText('Bold')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Italic')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Underline')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Inline code')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Link')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Code block')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Quote')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Bulleted list')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Numbered list')).toBeInTheDocument();
    expect(within(editorGroup).getByText('Task list')).toBeInTheDocument();
  });

  it('allows assigning an editor shortcut to the same key combo as a non-editor app shortcut', () => {
    renderModal();
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    // toggleTheme is 'Ctrl+L' (non-editor app shortcut).
    // Assigning 'Ctrl+L' to editorBold ('Bold') is allowed across groups.
    const boldInput = getShortcutInputForAction('Bold');
    fireEvent.focus(boldInput);
    fireEvent.keyDown(boldInput, { key: 'l', ctrlKey: true });

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      keybindings: expect.objectContaining({
        editorBold: 'Ctrl+L',
      }),
    });
    expect(screen.queryByText(/already assigned/i)).not.toBeInTheDocument();
  });

  it('allows assigning a non-editor app shortcut to the same key combo as an editor shortcut', () => {
    renderModal();
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    // editorItalic is 'Ctrl+I' (editor shortcut).
    // Assigning 'Ctrl+I' to toggleSidebar ('Toggle sidebar visibility') is allowed across groups.
    const sidebarInput = getShortcutInputForAction('Toggle sidebar visibility');
    fireEvent.focus(sidebarInput);
    fireEvent.keyDown(sidebarInput, { key: 'i', ctrlKey: true });

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      keybindings: expect.objectContaining({
        toggleSidebar: 'Ctrl+I',
      }),
    });
    expect(screen.queryByText(/already assigned/i)).not.toBeInTheDocument();
  });

  it('rejects assigning an editor shortcut to the same key combo as another active editor shortcut', () => {
    renderModal();
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    // editorItalic is currently 'Ctrl+I' (active editor shortcut).
    // Attempting to set editorBold ('Bold') to 'Ctrl+I' must be rejected as duplicate within the Markdown Editor group.
    const boldInput = getShortcutInputForAction('Bold');
    fireEvent.focus(boldInput);
    fireEvent.keyDown(boldInput, { key: 'i', ctrlKey: true });

    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(screen.getByText(/"Ctrl\+I" is already assigned/i)).toBeInTheDocument();
  });
});
