import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { groupToolbarMenuItems, ToolbarActionMenu } from '../../../../ui/src/components/shared/ToolbarActionMenu';

type MenuProps = Parameters<typeof ToolbarActionMenu>[0];
const noop = () => {};

function renderMenu(overrides: Partial<MenuProps> = {}) {
  render(
    <ToolbarActionMenu
      triggerTooltip="More actions"
      homeLabel="Home" themeLabel="Theme" editLabel="Edit" settingsLabel="Settings" exportLabel="Export Center"
      homeTooltip="Home" themeTooltip="Theme" editTooltip="Edit" settingsTooltip="Settings"
      canEdit isDark={false}
      onHome={noop} onTheme={noop} onEdit={noop} onSettings={noop} onExport={noop}
      historyLabel="History"
      showHistory
      sidebarLabel="Sidebar" sidebarTooltip="Sidebar" onSidebarToggle={noop}
      tocLabel="TOC" tocTooltip="TOC" onTocToggle={noop}
      showInsights insightsLabel="Insights" onInsightsToggle={noop}
      focusModeLabel="Focus" focusModeTooltip="Focus" onFocusModeToggle={noop}
      showFullscreen fullscreenLabel="Fullscreen" fullscreenTooltip="Fullscreen" onFullscreenToggle={noop}
      showResetZoom resetZoomLabel="Reset Zoom" resetZoomTooltip="Reset Zoom" onResetZoom={noop}
      {...overrides}
    />,
  );
  fireEvent.click(screen.getByLabelText('More actions'));
  return screen.getByRole('menu');
}

/** Flattens the menu panel into item labels and '|' markers for separators. */
function menuSequence(menu: HTMLElement): string[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="separator"]')).map((el) =>
    el.getAttribute('role') === 'separator' ? '|' : (el.querySelector('.btn-label')?.textContent ?? el.textContent ?? '').trim(),
  );
}

describe('ToolbarActionMenu grouping', () => {
  it('orders items as document, appearance, then panel groups with one separator between each', () => {
    const menu = renderMenu();
    expect(menuSequence(menu)).toEqual([
      'Home', 'Edit', 'History',
      '|',
      'Theme', 'Sidebar', 'TOC', 'Focus', 'Fullscreen', 'Reset Zoom',
      '|',
      'Insights', 'Export Center', 'Settings',
    ]);
    expect(within(menu).getAllByRole('separator')).toHaveLength(2);
  });

  it('omits edit/insights/fullscreen/zoom when hidden without leaving empty groups or doubled separators', () => {
    const menu = renderMenu({ showEdit: false, showInsights: false, showFullscreen: false, showResetZoom: false });
    expect(menuSequence(menu)).toEqual([
      'Home', 'History', '|', 'Theme', 'Sidebar', 'TOC', 'Focus', '|', 'Export Center', 'Settings',
    ]);
  });

  it('never renders leading, trailing, or doubled separators when groups are empty', () => {
    const ids = (items: string[]) => groupToolbarMenuItems(items.map((id) => ({ id })))
      .map(({ item, dividerBefore }) => `${dividerBefore ? '|' : ''}${item.id}`);
    expect(ids(['export', 'home', 'settings'])).toEqual(['home', '|export', 'settings']);
    expect(ids(['theme', 'settings'])).toEqual(['theme', '|settings']);
    expect(ids(['home', 'history'])).toEqual(['home', 'history']);
    expect(ids(['sidebar', 'theme'])).toEqual(['sidebar', 'theme']);
    expect(ids([])).toEqual([]);
  });

  it('renders separators as accessible horizontal dividers', () => {
    const menu = renderMenu();
    for (const separator of within(menu).getAllByRole('separator')) {
      expect(separator).toHaveClass('toolbar-action-menu__separator');
      expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    }
  });
});

describe('ToolbarActionMenu keyboard navigation', () => {
  it('moves across group boundaries with arrow keys, skipping separators', () => {
    const menu = renderMenu();
    const history = screen.getByRole('menuitem', { name: 'History' });
    history.focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Theme' }));
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(history);

    screen.getByRole('menuitem', { name: 'Reset Zoom' }).focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Insights' }));
  });

  it('wraps around and supports Home/End while skipping disabled items', () => {
    const menu = renderMenu({ canEdit: false });
    screen.getByRole('menuitem', { name: 'Settings' }).focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Home' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'History' }));
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Settings' }));
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Home' }));
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Settings' }));
  });
});
