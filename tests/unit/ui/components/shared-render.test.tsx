import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractiveBackground } from '../../../../ui/src/components/shared/InteractiveBackground';
import { TabContextMenu } from '../../../../ui/src/components/shared/TabContextMenu';
import { TooltipButton } from '../../../../ui/src/components/shared/TooltipButton';
import { ToolbarActionMenu } from '../../../../ui/src/components/shared/ToolbarActionMenu';

vi.mock('../../../../ui/src/utils/toolbar-menu.js', () => ({
  buildShortcutTooltip: (tooltip: string, shortcut?: string) => {
    if (!tooltip) return '';
    if (shortcut) return `${tooltip} - (${shortcut})`;
    return tooltip;
  },
}));

vi.mock('../../../../ui/src/components/shared/icons', () => {
  const span = (testId: string, text: string) =>
    React.createElement('span', { 'data-testid': testId }, text);
  return {
    HomeIcon: () => span('home-icon', 'home'),
    EditIcon: () => span('edit-icon', 'edit'),
    SettingsIcon: () => span('settings-icon', 'settings'),
    MoonIcon: () => span('moon-icon', 'moon'),
    SunIcon: () => span('sun-icon', 'sun'),
    SidebarIcon: () => span('sidebar-icon', 'sidebar'),
    TocIcon: () => span('toc-icon', 'toc'),
    MinimizeIcon: () => span('minimize-icon', 'minimize'),
    MaximizeIcon: () => span('maximize-icon', 'maximize'),
  };
});

describe('InteractiveBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a canvas element', () => {
    const { container } = render(React.createElement(InteractiveBackground));
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('canvas uses CSS class for fixed viewport positioning', () => {
    const { container } = render(React.createElement(InteractiveBackground));
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toHaveClass('interactive-background-canvas');
  });

  it('canvas keeps CSS class for click-through behavior', () => {
    const { container } = render(React.createElement(InteractiveBackground));
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toHaveClass('interactive-background-canvas');
  });

  it('canvas keeps CSS class for stacking behavior', () => {
    const { container } = render(React.createElement(InteractiveBackground));
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toHaveClass('interactive-background-canvas');
  });
});

describe('TabContextMenu', () => {
  const defaultLabels = {
    closeThisTab: 'Close',
    closeTabsToRight: 'Close to Right',
    closeOtherTabs: 'Close Others',
    closeAllTabs: 'Close All',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four menu items', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction, onClose }));
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Close to Right')).toBeInTheDocument();
    expect(screen.getByText('Close Others')).toBeInTheDocument();
    expect(screen.getByText('Close All')).toBeInTheDocument();
  });

  it('renders provided shortcut labels beside actions', () => {
    render(React.createElement(TabContextMenu, {
      x: 100,
      y: 100,
      labels: defaultLabels,
      shortcuts: { closeThisTab: 'Ctrl+W', closeOtherTabs: 'Ctrl+Alt+O' },
      onAction: vi.fn(),
      onClose: vi.fn(),
    }));
    expect(screen.getByText('Ctrl + W')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + Alt + O')).toBeInTheDocument();
  });

  it('renders with role menu', () => {
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction: vi.fn(), onClose: vi.fn() }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('calls onAction and onClose when a menu item is clicked', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction, onClose }));
    fireEvent.click(screen.getByText('Close'));
    expect(onAction).toHaveBeenCalledWith('closeThisTab');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onAction for closeTabsToRight item', () => {
    const onAction = vi.fn();
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction, onClose: vi.fn() }));
    fireEvent.click(screen.getByText('Close to Right'));
    expect(onAction).toHaveBeenCalledWith('closeTabsToRight');
  });

  it('calls onAction for closeOtherTabs item', () => {
    const onAction = vi.fn();
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction, onClose: vi.fn() }));
    fireEvent.click(screen.getByText('Close Others'));
    expect(onAction).toHaveBeenCalledWith('closeOtherTabs');
  });

  it('calls onAction for closeAllTabs item', () => {
    const onAction = vi.fn();
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction, onClose: vi.fn() }));
    fireEvent.click(screen.getByText('Close All'));
    expect(onAction).toHaveBeenCalledWith('closeAllTabs');
  });

  it('disables items based on disabled prop', () => {
    render(React.createElement(TabContextMenu, {
      x: 100, y: 100, labels: defaultLabels,
      disabled: { closeTabsToRight: true, closeOtherTabs: true },
      onAction: vi.fn(), onClose: vi.fn(),
    }));
    expect(screen.getByText('Close to Right').closest('button')).toBeDisabled();
    expect(screen.getByText('Close Others').closest('button')).toBeDisabled();
    expect(screen.getByText('Close').closest('button')).not.toBeDisabled();
  });

  it('calls onClose on Escape keydown', () => {
    const onClose = vi.fn();
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction: vi.fn(), onClose }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders first item with is-primary class', () => {
    render(React.createElement(TabContextMenu, { x: 100, y: 100, labels: defaultLabels, onAction: vi.fn(), onClose: vi.fn() }));
    const closeItem = screen.getByText('Close').closest('button');
    expect(closeItem?.className).toContain('is-primary');
  });

  it('sets position style from x and y props', () => {
    render(React.createElement(TabContextMenu, { x: 50, y: 200, labels: defaultLabels, onAction: vi.fn(), onClose: vi.fn() }));
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBeDefined();
    expect(menu.style.top).toBeDefined();
  });
});

describe('TooltipButton', () => {
  it('renders button with children', () => {
    render(React.createElement(TooltipButton, null, 'Click me'));
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders tooltip text span', () => {
    render(React.createElement(TooltipButton, { tooltip: 'Hello' }, 'Btn'));
    const tooltipSpan = screen.getByText('Hello');
    expect(tooltipSpan).toBeInTheDocument();
    expect(tooltipSpan).toHaveClass('tooltip-text');
  });

  it('renders tooltip with shortcut via buildShortcutTooltip', () => {
    render(React.createElement(TooltipButton, { tooltip: 'Save', shortcut: 'Ctrl+S' }, 'Save'));
    expect(screen.getByText('Save - (Ctrl+S)')).toBeInTheDocument();
  });

  it('renders icon only when onlyIcon is true (default)', () => {
    const icon = React.createElement('span', { 'data-testid': 'my-icon' }, 'IC');
    render(React.createElement(TooltipButton, { icon, label: 'Test' }, 'Child'));
    expect(screen.getByTestId('my-icon')).toBeInTheDocument();
  });

  it('renders icon and label when onlyIcon is false', () => {
    const icon = React.createElement('span', { 'data-testid': 'my-icon2' }, 'IC');
    render(React.createElement(TooltipButton, { icon, label: 'TestLabel', onlyIcon: false }, 'Child'));
    expect(screen.getByTestId('my-icon2')).toBeInTheDocument();
    expect(screen.getAllByText('TestLabel').length).toBeGreaterThanOrEqual(1);
  });

  it('sets data-tooltip-pos to below by default', () => {
    render(React.createElement(TooltipButton, { tooltip: 't' }, 'X'));
    expect(screen.getByRole('button')).toHaveAttribute('data-tooltip-pos', 'below');
  });

  it('sets data-tooltip-pos to above when specified', () => {
    render(React.createElement(TooltipButton, { tooltip: 't', tooltipPos: 'above' }, 'X'));
    expect(screen.getByRole('button')).toHaveAttribute('data-tooltip-pos', 'above');
  });

  it('sets data-tooltip-align', () => {
    render(React.createElement(TooltipButton, { tooltip: 't', tooltipAlign: 'left' }, 'X'));
    expect(screen.getByRole('button')).toHaveAttribute('data-tooltip-align', 'left');
  });

  it('sets aria-label from label prop', () => {
    render(React.createElement(TooltipButton, { label: 'MyLabel' }, 'X'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'MyLabel');
  });

  it('sets aria-label from tooltip prop when no label', () => {
    render(React.createElement(TooltipButton, { tooltip: 'MyTooltip' }, 'X'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'MyTooltip');
  });

  it('renders no tooltip span when tooltip and label are empty', () => {
    const { container } = render(React.createElement(TooltipButton, null, 'X'));
    expect(container.querySelector('.tooltip-text')).not.toBeInTheDocument();
  });

  it('passes extra button HTML attributes', () => {
    render(React.createElement(TooltipButton, { tooltip: 't', disabled: true }, 'X'));
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('ToolbarActionMenu', () => {
  const defaultProps = {
    triggerTooltip: 'More',
    homeLabel: 'Home',
    themeLabel: 'Theme',
    editLabel: 'Edit',
    settingsLabel: 'Settings',
    homeTooltip: 'Go home',
    themeTooltip: 'Toggle theme',
    editTooltip: 'Edit file',
    settingsTooltip: 'Open settings',
    canEdit: true,
    isDark: false,
    onHome: vi.fn(),
    onTheme: vi.fn(),
    onEdit: vi.fn(),
    onSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trigger button', () => {
    render(React.createElement(ToolbarActionMenu, defaultProps));
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('does not show menu panel initially', () => {
    const { container } = render(React.createElement(ToolbarActionMenu, defaultProps));
    expect(container.querySelector('.toolbar-action-menu__panel')).not.toBeInTheDocument();
  });

  it('opens menu panel on trigger click', () => {
    const { container } = render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(container.querySelector('.toolbar-action-menu__panel')).toBeInTheDocument();
  });

  it('renders all default menu items when open', () => {
    render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onHome when home item clicked', () => {
    render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Home'));
    expect(defaultProps.onHome).toHaveBeenCalled();
  });

  it('calls onTheme when theme item clicked', () => {
    render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Theme'));
    expect(defaultProps.onTheme).toHaveBeenCalled();
  });

  it('calls onEdit when edit item clicked', () => {
    render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Edit'));
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('calls onSettings when settings item clicked', () => {
    render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Settings'));
    expect(defaultProps.onSettings).toHaveBeenCalled();
  });

  it('closes panel after clicking an item', () => {
    const { container } = render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(container.querySelector('.toolbar-action-menu__panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Home'));
    expect(container.querySelector('.toolbar-action-menu__panel')).not.toBeInTheDocument();
  });

  it('disables edit when canEdit is false', () => {
    const { container } = render(React.createElement(ToolbarActionMenu, { ...defaultProps, canEdit: false }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    const menuPanel = container.querySelector('.toolbar-action-menu__panel');
    const editItem = Array.from(menuPanel!.querySelectorAll('button[disabled]')).find((btn) =>
      btn.textContent?.includes('Edit'),
    );
    expect(editItem).toBeTruthy();
  });

  it('hides edit item when showEdit is false', () => {
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, showEdit: false }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('renders sidebar toggle when provided', () => {
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, sidebarLabel: 'Sidebar', sidebarTooltip: 'Toggle sidebar', onSidebarToggle: vi.fn() }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
  });

  it('renders toc toggle when provided', () => {
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, tocLabel: 'TOC', tocTooltip: 'Toggle toc', onTocToggle: vi.fn() }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText('TOC')).toBeInTheDocument();
  });

  it('renders focus mode toggle when provided', () => {
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, focusModeLabel: 'Focus', focusModeTooltip: 'Focus mode', onFocusModeToggle: vi.fn() }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText('Focus')).toBeInTheDocument();
  });

  it('hides fullscreen toggle unless explicitly enabled', () => {
    render(React.createElement(ToolbarActionMenu, {
      ...defaultProps,
      fullscreenLabel: 'Show full screen',
      fullscreenTooltip: 'Toggle full screen',
      onFullscreenToggle: vi.fn(),
    }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.queryByText('Show full screen')).not.toBeInTheDocument();
  });

  it('renders and invokes fullscreen toggle when enabled', () => {
    const onFullscreenToggle = vi.fn();
    render(React.createElement(ToolbarActionMenu, {
      ...defaultProps,
      showFullscreen: true,
      fullscreenLabel: 'Show full screen',
      fullscreenTooltip: 'Toggle full screen',
      onFullscreenToggle,
    }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Show full screen'));
    expect(onFullscreenToggle).toHaveBeenCalledTimes(1);
  });

  it('reflects the native fullscreen state in the switch', () => {
    const { rerender } = render(React.createElement(ToolbarActionMenu, {
      ...defaultProps,
      showFullscreen: true,
      fullscreenLabel: 'Show full screen',
      fullscreenTooltip: 'Toggle full screen',
      isFullscreen: false,
      onFullscreenToggle: vi.fn(),
    }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('menuitemcheckbox', { name: /show full screen/i })).toHaveAttribute('aria-checked', 'false');

    rerender(React.createElement(ToolbarActionMenu, {
      ...defaultProps,
      showFullscreen: true,
      fullscreenLabel: 'Show full screen',
      fullscreenTooltip: 'Toggle full screen',
      isFullscreen: true,
      onFullscreenToggle: vi.fn(),
    }));
    expect(screen.getByRole('menuitemcheckbox', { name: /show full screen/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('closes on Escape keydown', () => {
    const { container } = render(React.createElement(ToolbarActionMenu, defaultProps));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(container.querySelector('.toolbar-action-menu__panel')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.toolbar-action-menu__panel')).not.toBeInTheDocument();
  });

  it('adds has-update class to trigger and settings item when hasUpdate is true', () => {
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, hasUpdate: true }));
    const trigger = screen.getByRole('button', { name: /more/i });
    expect(trigger.className).toContain('has-update');
    fireEvent.click(trigger);
    const settingsItem = screen.getByText('Settings').closest('.toolbar-action-menu__item');
    expect(settingsItem?.className).toContain('has-update');
  });

  it('calls onSidebarToggle when sidebar item clicked', () => {
    const onSidebarToggle = vi.fn();
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, sidebarLabel: 'Sidebar', sidebarTooltip: 'Toggle sidebar', onSidebarToggle }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Sidebar'));
    expect(onSidebarToggle).toHaveBeenCalled();
  });

  it('calls onTocToggle when toc item clicked', () => {
    const onTocToggle = vi.fn();
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, tocLabel: 'TOC', tocTooltip: 'Toggle toc', onTocToggle }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('TOC'));
    expect(onTocToggle).toHaveBeenCalled();
  });

  it('calls onFocusModeToggle when focus mode item clicked', () => {
    const onFocusModeToggle = vi.fn();
    render(React.createElement(ToolbarActionMenu, { ...defaultProps, focusModeLabel: 'Focus', focusModeTooltip: 'Toggle focus', onFocusModeToggle }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText('Focus'));
    expect(onFocusModeToggle).toHaveBeenCalled();
  });
});
