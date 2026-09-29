import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsShortcutsPanel } from '../../../../ui/src/components/Settings/SettingsShortcutsPanel';
import { ACTIONS_LIST } from '../../../../ui/src/components/Settings/settingsActions';

describe('Settings shortcut groups', () => {
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
});
