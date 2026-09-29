import { describe, expect, it } from 'vitest';
import { ACTIONS_LIST } from '../../../../ui/src/components/Settings/settingsActions';
import { groupShortcutActions } from '../../../../ui/src/components/Settings/shortcutGroups';
import { filterKeyboardShortcutActions } from '../../../../ui/src/components/Settings/keyboardShortcutSearch';

const labels = Object.fromEntries(ACTIONS_LIST.map((action) => [action.id, action.label]));

describe('shortcut groups', () => {
  it('puts every action in one mission group and sorts groups and actions alphabetically', () => {
    const groups = groupShortcutActions(ACTIONS_LIST, labels, 'en');
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

    expect(groups.flatMap((group) => group.actions.map((action) => action.id)).sort())
      .toEqual(ACTIONS_LIST.map((action) => action.id).sort());
    expect(groups.map((group) => group.label))
      .toEqual([...groups.map((group) => group.label)].sort(collator.compare));
    for (const group of groups) {
      expect(group.actions.map((action) => labels[action.id]))
        .toEqual([...group.actions.map((action) => labels[action.id])].sort(collator.compare));
    }
  });

  it('keeps the owning group when search matches one shortcut', () => {
    const matches = filterKeyboardShortcutActions(ACTIONS_LIST, 'save current document', labels);
    const groups = groupShortcutActions(matches, labels, 'en');

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Document');
    expect(groups[0].actions.map((action) => action.id)).toEqual(['saveCurrentDocument']);
  });
});
