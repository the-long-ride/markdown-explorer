import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsShortcutsPanel } from '../../../../ui/src/components/Settings/SettingsShortcutsPanel';
import { SettingsModal } from '../../../../ui/src/components/Settings/SettingsModal';
import { ACTIONS_LIST } from '../../../../ui/src/components/Settings/settingsActions';
import { getDefaultKeybindingsForRuntime } from '../../../../ui/src/contexts/appStateConstants';
import { getTranslations } from '../../../../ui/src/contexts/translations';

const mockUpdateSettings = vi.fn();
const mockPostMessage = vi.fn();
const mockSetTheme = vi.fn();
const mockSetThemeStyle = vi.fn();
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
    setTheme: mockSetTheme,
    setThemeStyle: mockSetThemeStyle,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mockPostMessage,
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

  it('filters and clears shortcut rows, toggles bindings, and lets focus move to a different recording field', () => {
    vi.useFakeTimers();
    try {
      const t = getTranslations('en');
      const { rerender } = renderModal();
      fireEvent.click(screen.getByText('Keyboard Shortcuts'));
      const search = screen.getByRole('textbox', { name: t.ui.shortcutSearchLabel });
      const clear = screen.getByRole('button', { name: t.ui.shortcutSearchClear });
      expect(clear).toBeDisabled();
      fireEvent.change(search, { target: { value: 'Italic' } });
      expect(getShortcutInputForAction('Italic')).toBeInTheDocument();
      expect(screen.queryByText('Bold')).not.toBeInTheDocument();
      fireEvent.click(clear);
      expect(search).toHaveValue('');
      const bold = getShortcutInputForAction('Bold');
      const italic = getShortcutInputForAction('Italic');
      fireEvent.focus(bold);
      expect(bold).toHaveValue(t.ui.shortcutPressKeys);
      fireEvent.blur(bold);
      fireEvent.focus(italic);
      act(() => { vi.advanceTimersByTime(250); });
      expect(italic).toHaveValue(t.ui.shortcutPressKeys);
      expect(bold).toHaveValue('Ctrl + B');
      fireEvent.blur(italic);
      act(() => { vi.advanceTimersByTime(250); });
      expect(italic).toHaveValue('Ctrl + I');
      const disable = t.ui.shortcutDisable.replace('{action}', 'Bold');
      fireEvent.click(screen.getByRole('switch', { name: disable }));
      expect(mockUpdateSettings).toHaveBeenLastCalledWith({ disabledKeybindings: { editorBold: true } });
      mockState.settings.disabledKeybindings = { editorBold: true };
      rerender(<SettingsModal isOpen onClose={vi.fn()} updateCheck={defaultUpdateCheck} hostUpdateState={defaultHostUpdateState}
        onDownloadUpdate={vi.fn()} onScheduleUpdateOnExit={vi.fn()} onRestartAndApplyUpdate={vi.fn()} onOpenChangelog={vi.fn()} />);
      expect(bold).toBeDisabled();
      fireEvent.click(screen.getByRole('switch', { name: t.ui.shortcutEnable.replace('{action}', 'Bold') }));
      expect(mockUpdateSettings).toHaveBeenLastCalledWith({ disabledKeybindings: { editorBold: false } });
    } finally {
      vi.useRealTimers();
    }
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

  it.each([
    { name: 'disabled binding', key: 'i', modifiers: { metaKey: true }, expected: 'Ctrl+I' },
    { name: 'Space chord', key: ' ', modifiers: { metaKey: true, shiftKey: true, altKey: true }, expected: 'Ctrl+Shift+Alt+Space' },
  ])('records a $name when there is no active conflict', ({ key, modifiers, expected }) => {
    mockState.settings.disabledKeybindings = { editorItalic: true };
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: getTranslations('en').shortcuts }));
    const input = getShortcutInputForAction('Bold');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key, ...modifiers });
    expect(mockUpdateSettings).toHaveBeenCalledExactlyOnceWith({
      keybindings: expect.objectContaining({ editorBold: expected }),
    });
  });

  it('opens the language chooser, dismisses it without changing settings, and applies a selection', () => {
    const t = getTranslations('en');
    renderModal();
    const trigger = screen.getByRole('button', { name: t.tooltips.switchLanguage });
    fireEvent.click(trigger);
    const list = screen.getByRole('listbox', { name: t.ui.languages });
    expect(within(list).getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.pointerDown(trigger);
    expect(list).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(list).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: t.ui.languages })).not.toBeInTheDocument();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /français/i }));
    expect(mockUpdateSettings).toHaveBeenCalledExactlyOnceWith({ language: 'fr' });
    expect(screen.queryByRole('listbox', { name: t.ui.languages })).not.toBeInTheDocument();
  });

  it('ignores standalone modifiers, warns about the IME shortcut, and resets only after confirmation', () => {
    const t = getTranslations('en');
    mockState.themeStyle = 'pet-k-ink';
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: t.shortcuts }));
    const input = getShortcutInputForAction('Bold');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Control', ctrlKey: true });
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: ' ', ctrlKey: true });
    expect(screen.getByText(t.bannedShortcutImeMessage)).toBeInTheDocument();
    expect(screen.getByAltText(t.ui.warningMascotAlt)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.bannedShortcutDismiss }));
    expect(screen.queryByText(t.bannedShortcutImeMessage)).not.toBeInTheDocument();
    const reset = screen.getByRole('button', { name: t.resetShortcuts });
    fireEvent.click(reset);
    expect(screen.getByText(t.resetShortcutsConfirmBody)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(t.resetShortcutsConfirmBody)).not.toBeInTheDocument();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    fireEvent.click(reset);
    fireEvent.click(screen.getByRole('button', { name: t.confirmResetShortcuts }));
    expect(mockUpdateSettings).toHaveBeenCalledExactlyOnceWith({
      keybindings: getDefaultKeybindingsForRuntime('desktop'), disabledKeybindings: {},
    });
    expect(screen.queryByText(t.resetShortcutsConfirmBody)).not.toBeInTheDocument();
  });

  it('downloads a settings backup, reports malformed JSON, and restores the exported appearance', async () => {
    const t = getTranslations('en');
    const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:settings-backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      const { container } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: t.updateBackup }));
      const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
      const openPicker = vi.spyOn(input, 'click').mockImplementation(() => {});
      fireEvent.click(screen.getByRole('button', { name: t.importJson }));
      expect(openPicker).toHaveBeenCalledOnce();
      fireEvent.change(input, { target: { files: [] } });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      fireEvent.change(input, { target: { files: [new File(['{no'], 'invalid.json')] } });
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t.settingsData.invalidJson));
      expect(mockUpdateSettings).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: t.exportJson }));
      expect(screen.getByRole('status')).toHaveTextContent(t.settingsData.exported);
      expect(anchorClick.mock.contexts[0]).toHaveAttribute('download', expect.stringMatching(/^markdown-explorer-settings-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:settings-backup');
      const backup = new File([createObjectURL.mock.calls[0][0]], 'backup.json', { type: 'application/json' });
      fireEvent.change(input, { target: { files: [backup] } });
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t.settingsData.imported));
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', defaultHtmlPreview: false }));
      expect(mockSetTheme).toHaveBeenCalledExactlyOnceWith('dark');
      expect(mockSetThemeStyle).toHaveBeenCalledExactlyOnceWith('default');
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'replaceRecentWorkspaces', recentWorkspaces: [] });
    } finally {
      vi.unstubAllGlobals();
      anchorClick.mockRestore();
    }
  });
});
