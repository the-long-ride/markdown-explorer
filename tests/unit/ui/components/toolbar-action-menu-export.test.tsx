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
    const items = screen.getAllByRole('menuitem');
    const labels = items.map((item) => item.textContent?.trim());
    expect(labels.indexOf('Export Center')).toBeGreaterThan(-1);
    expect(labels.indexOf('Export Center')).toBeLessThan(labels.indexOf('Settings'));

    fireEvent.click(screen.getByText('Export Center'));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
