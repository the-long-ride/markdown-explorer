import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeOnboardingModal } from '../../../ui/src/components/Modal/ThemeOnboardingModal';
import { createInitialState, type AppState } from '../../../ui/src/contexts/appStateModel';

const mockMethods = {
  setTheme: vi.fn(),
  setThemeStyle: vi.fn(),
  updateSettings: vi.fn(),
};
let currentState: AppState;

vi.mock('../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: currentState, ...mockMethods }),
}));

function renderModal() {
  const onComplete = vi.fn();
  const onOpenSettings = vi.fn();
  render(
    <ThemeOnboardingModal isOpen onComplete={onComplete} onOpenSettings={onOpenSettings} />,
  );
  return { onComplete, onOpenSettings };
}

describe('ThemeOnboardingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentState = createInitialState(undefined, false);
  });
  afterEach(() => cleanup());

  test('shows language selector with all locale options', () => {
    renderModal();
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.options.length).toBe(9);
  });

  test('shows settings hint and open-settings button', () => {
    const { onOpenSettings } = renderModal();
    const button = screen.getByRole('button', { name: /open settings/i });
    fireEvent.click(button);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test('hides desktop view section on non-desktop runtimes', () => {
    renderModal();
    expect(screen.queryByRole('radiogroup', { name: /desktop layout/i })).toBeNull();
  });

  test('shows desktop view section on desktop runtimes', () => {
    currentState = { ...createInitialState(undefined, false), appRuntime: 'desktop' as const };
    renderModal();
    expect(screen.queryByRole('radiogroup', { name: /desktop layout/i })).not.toBeNull();
  });
});
