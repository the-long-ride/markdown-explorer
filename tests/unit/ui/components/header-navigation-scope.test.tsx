import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SCOPE_NAVIGATION_STATE_EVENT } from '../../../../ui/src/components/Modal/scopeHistory';

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      currentFile: '/docs/readme.md',
      settings: { language: 'en', keybindings: { back: 'Alt+Left', forward: 'Alt+Right' }, disabledKeybindings: {} },
    },
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ tooltip, disabled, onClick }: any) => (
    <button type="button" aria-label={tooltip} disabled={disabled} onClick={onClick}>{tooltip}</button>
  ),
}));

import { NavigationHeaderActions } from '../../../../ui/src/components/shared/HeaderActionGroups';

describe('NavigationHeaderActions with Scope View', () => {
  it('disables app back and forward while Scope View is active', () => {
    render(
      <NavigationHeaderActions
        onBack={() => {}}
        onForward={() => {}}
        onRefresh={() => {}}
        canGoBack
        canGoForward
      />,
    );

    const back = screen.getByRole('button', { name: /back/i });
    const forward = screen.getByRole('button', { name: /forward/i });
    expect(back).not.toBeDisabled();
    expect(forward).not.toBeDisabled();

    act(() => {
      window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, {
        detail: { active: true, canPrevious: false, canNext: false },
      }));
    });

    expect(back).toBeDisabled();
    expect(forward).toBeDisabled();

    act(() => {
      window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, {
        detail: { active: false, canPrevious: false, canNext: false },
      }));
    });

    expect(back).not.toBeDisabled();
    expect(forward).not.toBeDisabled();
  });
});
