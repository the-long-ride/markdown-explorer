// =============================================================================
// components/Modal/ThemeOnboardingModal.tsx — First-run appearance setup
// =============================================================================

import { useAppState } from "../../contexts/AppStateContext";
import { THEME_MODE_OPTIONS } from "../../contexts/appStateConstants";
import { ThemeStylePicker } from "../Settings/ThemeStylePicker";
import { getTranslations } from "../../contexts/translations";

interface ThemeOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function ThemeOnboardingModal({
  isOpen,
  onComplete,
}: ThemeOnboardingModalProps) {
  const { state, setTheme, setThemeStyle } = useAppState();
  const t = getTranslations(state.settings.language || "en");

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
          <h2 id="themeOnboardingTitle">{t.onboarding.title}</h2>
          <p>{t.onboarding.description}</p>
        </div>

        <div className="theme-onboarding-card__section theme-onboarding-card__section--mode">
          <div className="settings-item__title">{t.colorMode}</div>
          <div
            className="segmented-control"
            role="radiogroup"
            aria-label={t.colorMode}
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
                {option.id === 'auto' ? t.auto : option.id === 'light' ? t.light : t.dark}
              </button>
            ))}
          </div>
        </div>

        <div className="theme-onboarding-card__section theme-onboarding-card__section--styles">
          <div className="settings-item__title">{t.themeStyle}</div>
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
            {t.onboarding.skip}
          </button>
          <button
            type="button"
            className="btn btn--accent theme-onboarding-card__continue"
            onClick={onComplete}
          >
            {t.terms.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
