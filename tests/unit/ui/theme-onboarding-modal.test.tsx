import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeOnboardingModal } from '../../../ui/src/components/Modal/ThemeOnboardingModal';
import { createInitialState, type AppState } from '../../../ui/src/contexts/appStateModel';
import { getTranslations } from '../../../ui/src/contexts/translations';

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
  const view = render(
    <ThemeOnboardingModal isOpen onComplete={onComplete} onOpenSettings={onOpenSettings} />,
  );
  return { ...view, onComplete, onOpenSettings };
}

describe('ThemeOnboardingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentState = createInitialState(undefined, false);
  });
  afterEach(() => cleanup());

  test('shows language selector with all locale options', () => {
    renderModal();
    const trigger = screen.getByRole('button', { name: /language/i });
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(9);
  });

  test('selects a locale and dismisses only the language menu on outside click or its first Escape', () => {
    const t = getTranslations('en');
    const { onComplete } = renderModal();
    const trigger = screen.getByRole('button', { name: t.onboarding.language });
    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(fireEvent.keyDown(document, { key: 'Enter' })).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('heading', { name: t.onboarding.title }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Français' }));
    expect(mockMethods.updateSettings).toHaveBeenCalledExactlyOnceWith({ language: 'fr' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  test('changes appearance and desktop view on Tauri without treating modified Enter as completion', () => {
    const t = getTranslations('en');
    currentState = { ...currentState, appRuntime: 'tauri', settings: { ...currentState.settings, desktopViewMode: 'tabs' } };
    const { onComplete, onOpenSettings, rerender } = renderModal();
    const layout = within(screen.getByRole('radiogroup', { name: t.onboarding.viewMode }));
    expect(layout.getByRole('button', { name: t.tabs })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(t.onboarding.viewModeTabsDesc)).toBeInTheDocument();
    fireEvent.click(layout.getByRole('button', { name: t.focus }));
    expect(mockMethods.updateSettings).toHaveBeenCalledWith({ desktopViewMode: 'focus' });
    fireEvent.click(screen.getByRole('button', { name: t.dark, exact: true }));
    expect(mockMethods.setTheme).toHaveBeenCalledExactlyOnceWith('dark');

    const openSettings = screen.getByRole('button', { name: t.onboarding.openSettings });
    openSettings.focus();
    expect(fireEvent.keyDown(openSettings, { key: 'Enter' })).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
    openSettings.blur();
    for (const modifier of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
      expect(fireEvent.keyDown(document, { key: 'Enter', [modifier]: true })).toBe(true);
    }
    expect(onComplete).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(document, { key: 'Enter' })).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();
    rerender(<ThemeOnboardingModal isOpen={false} onComplete={onComplete} onOpenSettings={onOpenSettings} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(true);
    expect(onComplete).toHaveBeenCalledOnce();
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

  test('sections and settings hint live inside the scrollable card body', () => {
    currentState = { ...createInitialState(undefined, false), appRuntime: 'desktop' as const };
    const { container } = renderModal();
    const card = container.querySelector('.theme-onboarding-card')!;
    const body = card.querySelector('.theme-onboarding-card__body')!;
    expect(body).not.toBeNull();
    // All scrollable content sections are inside the body…
    for (const selector of [
      '.theme-onboarding-card__section--language',
      '.theme-onboarding-card__section--mode',
      '.theme-onboarding-card__section--styles',
      '.theme-onboarding-card__section--view',
      '.theme-onboarding-card__hint',
    ]) {
      expect(body.querySelector(selector), selector).not.toBeNull();
      expect(card.querySelector(selector)).toBe(body.querySelector(selector));
    }
    // …while the header and action buttons stay outside it.
    expect(body.querySelector('.theme-onboarding-card__header')).toBeNull();
    expect(body.querySelector('.theme-onboarding-card__actions')).toBeNull();
  });
});
