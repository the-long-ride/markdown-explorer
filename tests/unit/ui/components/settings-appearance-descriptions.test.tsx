import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPreferencesPanel } from '../../../../ui/src/components/Settings/SettingsPreferencesPanel';
import { LANGUAGE_OPTIONS } from '../../../../ui/src/contexts/languageOptions';
import { TRANSLATIONS } from '../../../../ui/src/contexts/translationsData';

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
    const tableAlign = screen.getByRole('radiogroup', { name: 'Data Table Alignment' });
    expect(colorMode).toHaveAccessibleDescription('Use a light or dark color scheme');
    expect(desktopView).toHaveAccessibleDescription('Choose how workspaces appear');
    expect(tableAlign).toHaveAccessibleDescription('Default cell alignment for rendered Markdown and CSV data tables.');
    expect(colorMode.previousElementSibling).toHaveTextContent('Color modeUse a light or dark color scheme');
    expect(desktopView.previousElementSibling).toHaveTextContent('Desktop viewChoose how workspaces appear');
    expect(tableAlign.previousElementSibling).toHaveTextContent('Data Table AlignmentDefault cell alignment for rendered Markdown and CSV data tables.');

    fireEvent.mouseEnter(desktopView.closest('[data-row-id="desktop-view"]')!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(tableAlign.closest('[data-row-id="table-alignment"]')!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders desktop-view segmented control in web runtime even when isDesktop is false', () => {
    (window as any).__webBus = new EventTarget();
    try {
      const state = {
        theme: 'light',
        settings: { desktopViewMode: 'focus', keybindings: {} },
      } as any;
      render(
        <SettingsPreferencesPanel
          section="appearance"
          state={state}
          t={{ appearance: 'Appearance', subtitle: 'Choose your look', colorMode: 'Color mode', colorModeDesc: 'Use a light or dark color scheme', auto: 'Auto', light: 'Light', dark: 'Dark', desktopView: 'Desktop view', desktopViewDesc: 'Choose how workspaces appear {shortcut}', focus: 'Focus', tabs: 'Tabs' }}
          isDesktop={false}
          supportsTypography={false}
          setTheme={vi.fn()}
          setThemeStyle={vi.fn()}
          updateSettings={vi.fn()}
          onOpenThemeRemix={vi.fn()}
        />,
      );
      expect(screen.getByRole('radiogroup', { name: 'Desktop view' })).toBeInTheDocument();
    } finally {
      delete (window as any).__webBus;
    }
  });

  it('updates tableColumnAlignment setting when selecting alignment options', () => {
    const updateSettings = vi.fn();
    const state = {
      theme: 'light',
      settings: { desktopViewMode: 'focus', tableColumnAlignment: 'left', keybindings: {} },
    } as any;
    render(
      <SettingsPreferencesPanel
        section="appearance"
        state={state}
        t={{
          appearance: 'Appearance',
          subtitle: 'Choose your look',
          colorMode: 'Color mode',
          colorModeDesc: 'Use a light or dark color scheme',
          auto: 'Auto',
          light: 'Light',
          dark: 'Dark',
          desktopView: 'Desktop view',
          desktopViewDesc: 'Choose how workspaces appear',
          focus: 'Focus',
          tabs: 'Tabs',
          tableAlignment: 'Data Table Alignment',
          tableAlignmentDesc: 'Default cell alignment for rendered Markdown and CSV data tables.',
          alignLeft: 'Left',
          alignMiddle: 'Middle',
          alignRight: 'Right',
          alignIntelligent: 'Intelligent',
        }}
        isDesktop
        supportsTypography={false}
        setTheme={vi.fn()}
        setThemeStyle={vi.fn()}
        updateSettings={updateSettings}
        onOpenThemeRemix={vi.fn()}
      />,
    );

    const tableAlign = screen.getByRole('radiogroup', { name: 'Data Table Alignment' });
    expect(tableAlign).toHaveAccessibleDescription('Default cell alignment for rendered Markdown and CSV data tables.');
    expect(tableAlign).toHaveClass('segmented-control--quad', 'settings-table-align-switch');

    const middleOption = screen.getByRole('button', { name: 'Middle' });
    fireEvent.click(middleOption);
    expect(updateSettings).toHaveBeenCalledWith({ tableColumnAlignment: 'center' });

    const rightOption = screen.getByRole('button', { name: 'Right' });
    fireEvent.click(rightOption);
    expect(updateSettings).toHaveBeenCalledWith({ tableColumnAlignment: 'right' });

    const leftOption = screen.getByRole('button', { name: 'Left' });
    fireEvent.click(leftOption);
    expect(updateSettings).toHaveBeenCalledWith({ tableColumnAlignment: 'left' });

    const intelligentOption = screen.getByRole('button', { name: 'Intelligent' });
    fireEvent.click(intelligentOption);
    expect(updateSettings).toHaveBeenCalledWith({ tableColumnAlignment: 'intelligent' });
  });

  it('opens and closes the Data Table Alignment info dialog from the top-right info button', () => {
    const state = {
      theme: 'light',
      settings: { desktopViewMode: 'focus', tableColumnAlignment: 'intelligent', keybindings: {} },
    } as any;
    render(
      <SettingsPreferencesPanel
        section="appearance"
        state={state}
        t={{
          appearance: 'Appearance',
          subtitle: 'Choose your look',
          colorMode: 'Color mode',
          colorModeDesc: 'Use a light or dark color scheme',
          auto: 'Auto',
          light: 'Light',
          dark: 'Dark',
          desktopView: 'Desktop view',
          desktopViewDesc: 'Choose how workspaces appear',
          focus: 'Focus',
          tabs: 'Tabs',
        }}
        isDesktop
        supportsTypography={false}
        setTheme={vi.fn()}
        setThemeStyle={vi.fn()}
        updateSettings={vi.fn()}
        onOpenThemeRemix={vi.fn()}
      />,
    );

    const infoBtn = screen.getByRole('button', { name: 'Data Table Alignment information' });
    fireEvent.click(infoBtn);

    const dialog = screen.getByRole('dialog', { name: 'Intelligent Data Table Alignment' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Sequential numbers');
    expect(dialog).toHaveTextContent('Numbers');
    expect(dialog).toHaveTextContent('Date / Time');
    expect(dialog).toHaveTextContent('Checkboxes');
    expect(dialog).toHaveTextContent('Boolean');
    expect(dialog).toHaveTextContent('Sample Preview');
    expect(dialog).toHaveTextContent('$1,250.00');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Intelligent Data Table Alignment' })).not.toBeInTheDocument();

    fireEvent.click(infoBtn);
    expect(screen.getByRole('dialog', { name: 'Intelligent Data Table Alignment' })).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByRole('dialog', { name: 'Intelligent Data Table Alignment' })).not.toBeInTheDocument();
  });

  it('splits desktopViewDesc onto a new line after the first sentence terminator across all 9 locales', () => {
    for (const { id } of LANGUAGE_OPTIONS) {
      const desc = TRANSLATIONS[id].desktopViewDesc;
      expect(desc, `${id}.desktopViewDesc should break right after '.' or '。'`).toMatch(/[.。]\n[^\s]/);
      expect(desc, `${id}.desktopViewDesc should keep {shortcut} on the second line`).toMatch(/\n.*\{shortcut\}/);
    }
  });
});
