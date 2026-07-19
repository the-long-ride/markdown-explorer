import { describe, expect, it } from 'vitest';
import { getEnabledShortcut } from '../../../../ui/src/utils/shortcuts';

describe('getEnabledShortcut', () => {
  it('returns the binding while enabled', () => {
    expect(getEnabledShortcut({ keybindings: { refresh: 'F5' } }, 'refresh')).toBe('F5');
  });

  it('hides the binding while disabled', () => {
    expect(getEnabledShortcut({
      keybindings: { refresh: 'F5' },
      disabledKeybindings: { refresh: true },
    }, 'refresh')).toBeUndefined();
  });
});
