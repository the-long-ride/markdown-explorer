import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarItemMenu } from '../../../../ui/src/components/Sidebar/SidebarItemMenu';
import { buildSidebarItemMenuItems } from '../../../../ui/src/components/Sidebar/sidebarItemMenuItems';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { DOCUMENT_HISTORY_OPEN_EVENT } from '../../../../ui/src/components/shared/ToolbarActionMenu';

function createConnectedElement(rect: Partial<DOMRect> = {}): HTMLElement {
  const element = document.createElement('button');
  document.body.appendChild(element);
  element.getBoundingClientRect = vi.fn(() => ({
    x: 10,
    y: 10,
    left: 10,
    top: 10,
    right: 34,
    bottom: 34,
    width: 24,
    height: 24,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect));
  return element;
}

describe('SidebarItemMenu', () => {

  it('renders an ordered list of actions with icons, shortcuts, and separators', () => {
    const anchor = createConnectedElement();
    const sidebar = createConnectedElement({ left: 0, right: 280, width: 280 });

    render(
      <SidebarItemMenu
        anchor={anchor}
        sidebar={sidebar}
        menuLabel="HTML file actions"
        items={[
          {
            id: 'browser',
            label: 'Open in Browser',
            icon: <span>browser-icon</span>,
            onSelect: vi.fn(),
          },
          {
            id: 'preview',
            label: 'Show HTML Preview',
            icon: <span>preview-icon</span>,
            shortcut: 'Ctrl+ArrowRight',
            dividerBefore: true,
            onSelect: vi.fn(),
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole('menu', { name: 'HTML file actions' });
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByText('browser-icon')).toBeInTheDocument();
    expect(screen.getByText('preview-icon')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + →')).toBeInTheDocument();
    expect(screen.getByText('Show HTML Preview').closest('button')).toHaveClass('has-divider-before');
  });

  it('runs the selected action and closes the menu', () => {
    const anchor = createConnectedElement();
    const sidebar = createConnectedElement({ left: 0, right: 280, width: 280 });
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarItemMenu
        anchor={anchor}
        sidebar={sidebar}
        menuLabel="HTML file actions"
        items={[{ id: 'preview', label: 'Show HTML Preview', onSelect }]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Show HTML Preview' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('builds history menu item for document files and dispatches document history event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const items = buildSidebarItemMenuItems({
      state: { settings: { language: 'en' } } as any,
      target: { kind: 'file', path: '/repo/notes.md', anchor: null as any },
      canOpenHtmlInBrowser: false,
      canOpenItemLocations: false,
      translations: getTranslations('en'),
      bridge: {} as any,
      navigate: vi.fn(),
      isPinned: false,
      pinLimitReached: false,
      onTogglePin: vi.fn(),
    });

    const historyItem = items.find((item) => item.id === 'history');
    expect(historyItem).toBeDefined();
    expect(historyItem?.label).toBe('Revision (Git)');
    expect(historyItem?.disabled).toBeFalsy();

    historyItem?.onSelect();
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DOCUMENT_HISTORY_OPEN_EVENT,
        detail: { filePath: '/repo/notes.md' },
      }),
    );
    dispatchSpy.mockRestore();
  });

  it('does not include history menu item for folder targets', () => {
    const items = buildSidebarItemMenuItems({
      state: { settings: { language: 'en' } } as any,
      target: { kind: 'folder', path: '/repo/docs', anchor: null as any },
      canOpenHtmlInBrowser: false,
      canOpenItemLocations: false,
      translations: getTranslations('en'),
      bridge: {} as any,
      navigate: vi.fn(),
      isPinned: false,
      pinLimitReached: false,
      onTogglePin: vi.fn(),
    });

    const historyItem = items.find((item) => item.id === 'history');
    expect(historyItem).toBeUndefined();
  });
});
