import { describe, expect, test } from 'vitest';

import {
  buildShortcutTooltip,
  createToolbarMenuItems,
} from '../../../ui/src/utils/toolbar-menu.js';

describe('toolbar-menu', () => {
  test('buildShortcutTooltip appends shortcut label to tooltip copy', () => {
    expect(
      buildShortcutTooltip('Toggle Sidebar', 'Ctrl+b'),
    ).toBe('Toggle Sidebar - (Ctrl+B)');
  });

  test('buildShortcutTooltip leaves tooltip unchanged when no shortcut exists', () => {
    expect(
      buildShortcutTooltip('Open current file in editor', ''),
    ).toBe('Open current file in editor');
  });

  test('createToolbarMenuItems returns the requested button order', () => {
    const items = createToolbarMenuItems({
      labels: {
        home: 'Home',
        theme: 'Theme',
        edit: 'Edit',
        settings: 'Settings',
      },
      tooltips: {
        home: 'Welcome Page',
        theme: 'Toggle light/dark mode',
        edit: 'Open current file in editor',
        settings: 'Settings - update available',
      },
      shortcuts: {
        home: 'Ctrl+H',
        theme: 'Ctrl+L',
        settings: 'Ctrl+I',
      },
      canEdit: false,
    });

    expect(
      items.map((item: any) => ({
        id: item.id,
        label: item.label,
        disabled: item.disabled,
        tooltip: item.tooltip,
      })),
    ).toEqual([
      {
        id: 'home',
        label: 'Home',
        disabled: false,
        tooltip: 'Welcome Page - (Ctrl+H)',
      },
      {
        id: 'theme',
        label: 'Theme',
        disabled: false,
        tooltip: 'Toggle light/dark mode - (Ctrl+L)',
      },
      {
        id: 'edit',
        label: 'Edit',
        disabled: true,
        tooltip: 'Open current file in editor',
      },
      {
        id: 'settings',
        label: 'Settings',
        disabled: false,
        tooltip: 'Settings - update available - (Ctrl+I)',
      },
    ]);
  });

  test('buildShortcutTooltip uppercases lowercase single-letter shortcut keys', () => {
    expect(
      buildShortcutTooltip('Expand All', 'ctrl+shift+x'),
    ).toBe('Expand All - (ctrl+shift+X)');
  });
});
