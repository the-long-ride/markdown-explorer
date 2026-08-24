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
