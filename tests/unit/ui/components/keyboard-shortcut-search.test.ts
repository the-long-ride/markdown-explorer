import { describe, expect, test } from 'vitest';

import {
  filterKeyboardShortcutActions,
  KEYBOARD_SHORTCUT_ENGLISH_LABELS,
} from '../../../../ui/src/components/Settings/keyboardShortcutSearch';

const actions = [
  { id: 'searchCurrent', label: 'Søk i arbeidsområde' },
  { id: 'toggleTheme', label: 'Bytt tema' },
  { id: 'settings', label: 'Innstillinger' },
];

describe('filterKeyboardShortcutActions', () => {
  test('returns all actions for an empty query', () => {
    expect(filterKeyboardShortcutActions(actions, '   ', Object.fromEntries(actions.map((action) => [action.id, action.label])))).toEqual(actions);
  });

  test('matches canonical English labels while translated labels are active', () => {
    expect(filterKeyboardShortcutActions(actions, 'search current workspace', Object.fromEntries(actions.map((action) => [action.id, action.label])))).toEqual([actions[0]]);
  });

  test('matches translated labels and action IDs case-insensitively', () => {
    const translatedLabels = Object.fromEntries(actions.map((action) => [action.id, action.label]));

    expect(filterKeyboardShortcutActions(actions, 'BYTT', translatedLabels)).toEqual([actions[1]]);
    expect(filterKeyboardShortcutActions(actions, 'SETTINGS', translatedLabels)).toEqual([actions[2]]);
  });

  test('returns no actions when query matches no searchable field', () => {
    const translatedLabels = Object.fromEntries(actions.map((action) => [action.id, action.label]));

    expect(filterKeyboardShortcutActions(actions, 'not-found', translatedLabels)).toEqual([]);
  });

  test('contains canonical English labels for every built-in action', () => {
    expect(KEYBOARD_SHORTCUT_ENGLISH_LABELS.searchCurrent).toBe('Search current workspace');
    expect(KEYBOARD_SHORTCUT_ENGLISH_LABELS.toggleTheme).toBe('Toggle light/dark mode');
  });
});
