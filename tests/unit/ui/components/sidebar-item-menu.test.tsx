import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarItemMenu } from '../../../../ui/src/components/Sidebar/SidebarItemMenu';

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
});
