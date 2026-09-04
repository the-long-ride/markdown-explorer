import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolbarActionMenu } from '../../../../ui/src/components/shared/ToolbarActionMenu';

function renderMenu(onExport = vi.fn()) {
  render(
    <ToolbarActionMenu
      triggerTooltip="More Actions"
      homeLabel="Home"
      themeLabel="Theme"
      editLabel="Edit"
      settingsLabel="Settings"
      exportLabel="Export Center"
      homeTooltip="Home"
      themeTooltip="Theme"
      editTooltip="Edit"
      settingsTooltip="Settings"
      exportTooltip="Export documents"
      canEdit
      isDark={false}
      onHome={() => {}}
      onTheme={() => {}}
      onEdit={() => {}}
      onSettings={() => {}}
      onExport={onExport}
    />,
  );
  fireEvent.click(screen.getByLabelText('More Actions'));
  return onExport;
}

describe('ToolbarActionMenu Export Center item', () => {
  it('shows Export Center before Settings and invokes the export action', () => {
    const onExport = renderMenu();
    const exportItem = screen.getByRole('menuitem', { name: 'Export Center' });
    const settingsItem = screen.getByRole('menuitem', { name: 'Settings' });

    expect(exportItem.compareDocumentPosition(settingsItem) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    fireEvent.click(exportItem);
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});

describe('ToolbarActionMenu Workspace Insights item', () => {
  it('renders Workspace Insights with switch toggle when showInsights is true', () => {
    const onToggle = vi.fn();
    render(
      <ToolbarActionMenu
        triggerTooltip="More Actions"
        homeLabel="Home"
        themeLabel="Theme"
        editLabel="Edit"
        settingsLabel="Settings"
        homeTooltip="Home"
        themeTooltip="Theme"
        editTooltip="Edit"
        settingsTooltip="Settings"
        canEdit
        isDark={false}
        onHome={() => {}}
        onTheme={() => {}}
        onEdit={() => {}}
        onSettings={() => {}}
        showInsights
        insightsLabel="Workspace Insights"
        insightsActive={false}
        onInsightsToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText('More Actions'));
    const insightsItem = screen.getByRole('menuitem', { name: 'Workspace Insights' });
    expect(insightsItem).toBeInTheDocument();
    fireEvent.click(insightsItem);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('hides Workspace Insights item when showInsights is false', () => {
    render(
      <ToolbarActionMenu
        triggerTooltip="More Actions"
        homeLabel="Home"
        themeLabel="Theme"
        editLabel="Edit"
        settingsLabel="Settings"
        homeTooltip="Home"
        themeTooltip="Theme"
        editTooltip="Edit"
        settingsTooltip="Settings"
        canEdit
        isDark={false}
        onHome={() => {}}
        onTheme={() => {}}
        onEdit={() => {}}
        onSettings={() => {}}
        showInsights={false}
        insightsLabel="Workspace Insights"
      />,
    );
    fireEvent.click(screen.getByLabelText('More Actions'));
    expect(screen.queryByRole('menuitem', { name: 'Workspace Insights' })).not.toBeInTheDocument();
  });
});
