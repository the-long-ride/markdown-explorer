import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  SCOPE_NAVIGATION_REQUEST_EVENT,
  SCOPE_NAVIGATION_STATE_EVENT,
} from '../../../../ui/src/components/Modal/scopeHistory';

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      currentFile: '/docs/readme.md',
      settings: { language: 'en', keybindings: { back: 'Alt+Left', forward: 'Alt+Right' }, disabledKeybindings: {} },
    },
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ tooltip, shortcut, disabled, onClick }: any) => (
    <button type="button" aria-label={tooltip} data-shortcut={shortcut} disabled={disabled} onClick={onClick}>{tooltip}</button>
  ),
}));

import { NavigationHeaderActions } from '../../../../ui/src/components/shared/HeaderActionGroups';

describe('NavigationHeaderActions with Scope View', () => {
  it('routes topbar back and forward to active Scope history instead of main history', () => {
    const onBack = vi.fn();
    const onForward = vi.fn();
    const requests: string[] = [];
    const onRequest = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: string }>).detail?.direction;
      if (direction) requests.push(direction);
    };
    window.addEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, onRequest);
    try {
      render(
        <NavigationHeaderActions
          onBack={onBack}
          onForward={onForward}
          onRefresh={() => {}}
          canGoBack
          canGoForward
        />,
      );

      const back = screen.getByRole('button', { name: /back/i });
      const forward = screen.getByRole('button', { name: /forward/i });
      fireEvent.click(back);
      fireEvent.click(forward);
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onForward).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, {
          detail: { active: true, canPrevious: true, canNext: false },
        }));
      });

      expect(back).not.toBeDisabled();
      expect(forward).toBeDisabled();
      fireEvent.click(back);
      expect(requests).toEqual(['previous']);
      expect(onBack).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, {
          detail: { active: true, canPrevious: true, canNext: true },
        }));
      });
      fireEvent.click(forward);
      expect(requests).toEqual(['previous', 'next']);
      expect(onForward).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, onRequest);
    }
  });
});
