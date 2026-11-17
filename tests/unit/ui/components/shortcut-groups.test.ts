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

  it('provides localized descriptions for markdown editor shortcut group across all supported languages', () => {
    const languages = ['en', 'vi', 'zh', 'ja', 'ko', 'fr', 'es', 'ru', 'no'] as const;
    for (const lang of languages) {
      const groups = groupShortcutActions(ACTIONS_LIST, labels, lang);
      const markdownGroup = groups.find((group) => group.mission === 'markdownEditor');
      expect(markdownGroup).toBeDefined();
      expect(markdownGroup?.description).toBeTruthy();
    }

    const enGroups = groupShortcutActions(ACTIONS_LIST, labels, 'en');
    const enMarkdownGroup = enGroups.find((group) => group.mission === 'markdownEditor');
    expect(enMarkdownGroup?.description).toBe(
      'Active when focused inside the Markdown editor. These shortcuts take priority and can override general app shortcuts while editing.',
    );

    const viGroups = groupShortcutActions(ACTIONS_LIST, labels, 'vi');
    const viMarkdownGroup = viGroups.find((group) => group.mission === 'markdownEditor');
    expect(viMarkdownGroup?.description).toBe(
      'Áp dụng khi con trỏ đang ở trong trình soạn thảo Markdown. Các phím tắt này được ưu tiên và có thể ghi đè phím tắt chung của ứng dụng khi đang chỉnh sửa.',
    );
  });
});
