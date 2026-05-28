// =============================================================================
// components/Modal/ThemeOnboardingModal.tsx — First-run appearance setup
// =============================================================================

import {
  THEME_MODE_OPTIONS,
  useAppState,
} from "../../contexts/AppStateContext";
import { ThemeStylePicker } from "../Settings/ThemeStylePicker";

interface ThemeOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function ThemeOnboardingModal({
  isOpen,
  onComplete,
}: ThemeOnboardingModalProps) {
  const { state, setTheme, setThemeStyle } = useAppState();

  if (!isOpen) return null;

  return (
    <div
      className="mdn-modal theme-onboarding-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="themeOnboardingTitle"
    >
      <div className="settings-card theme-onboarding-card">
        <div className="settings-card__header theme-onboarding-card__header">
          <h2 id="themeOnboardingTitle">Choose Your Theme</h2>
          <p>You can change this later from Settings.</p>
        </div>

        <div className="theme-onboarding-card__section theme-onboarding-card__section--mode">
          <div className="settings-item__title">Color Mode</div>
          <div
            className="segmented-control"
            role="radiogroup"
            aria-label="Color mode"
          >
            {THEME_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`segmented-option${
                  state.theme === option.id ? " is-active" : ""
                }`}
                aria-pressed={state.theme === option.id}
                onClick={() => setTheme(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="theme-onboarding-card__section theme-onboarding-card__section--styles">
          <div className="settings-item__title">Theme Style</div>
          <ThemeStylePicker
            className="theme-onboarding-card__styles"
            value={state.themeStyle}
            onChange={setThemeStyle}
          />
        </div>

        <div className="theme-onboarding-card__actions">
          <button
            type="button"
            className="btn theme-onboarding-card__skip"
            onClick={onComplete}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn btn--accent theme-onboarding-card__continue"
            onClick={onComplete}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
