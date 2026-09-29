import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPreferencesPanel } from '../../../../ui/src/components/Settings/SettingsPreferencesPanel';

describe('Appearance settings descriptions', () => {
  it('shows each description below its label without a hover tooltip', () => {
    const state = {
      theme: 'light',
      settings: { desktopViewMode: 'focus', keybindings: {} },
    } as any;
    render(
      <SettingsPreferencesPanel
        section="appearance"
        state={state}
        t={{ appearance: 'Appearance', subtitle: 'Choose your look', colorMode: 'Color mode', colorModeDesc: 'Use a light or dark color scheme', auto: 'Auto', light: 'Light', dark: 'Dark', desktopView: 'Desktop view', desktopViewDesc: 'Choose how workspaces appear {shortcut}', focus: 'Focus', tabs: 'Tabs' }}
        isDesktop
        supportsTypography={false}
        setTheme={vi.fn()}
        setThemeStyle={vi.fn()}
        updateSettings={vi.fn()}
        onOpenThemeRemix={vi.fn()}
      />,
    );

    const colorMode = screen.getByRole('radiogroup', { name: 'Color mode' });
    const desktopView = screen.getByRole('radiogroup', { name: 'Desktop view' });
    expect(colorMode).toHaveAccessibleDescription('Use a light or dark color scheme');
    expect(desktopView).toHaveAccessibleDescription('Choose how workspaces appear');
    expect(colorMode.previousElementSibling).toHaveTextContent('Color modeUse a light or dark color scheme');
    expect(desktopView.previousElementSibling).toHaveTextContent('Desktop viewChoose how workspaces appear');

    fireEvent.mouseEnter(desktopView.closest('[data-row-id="desktop-view"]')!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
