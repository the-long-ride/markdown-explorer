// =============================================================================
// components/Modal/ThemeOnboardingModal.tsx — First-run appearance setup
// =============================================================================

import { useAppState } from "../../contexts/AppStateContext";
import { THEME_MODE_OPTIONS } from "../../contexts/appStateConstants";
import { LANGUAGE_OPTIONS, type AppLanguage } from "../../contexts/languageOptions";
import { ThemeStylePicker } from "../Settings/ThemeStylePicker";
import { getTranslations } from "../../contexts/translations";

interface ThemeOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onOpenSettings: () => void;
}

export function ThemeOnboardingModal({
  isOpen,
  onComplete,
  onOpenSettings,
}: ThemeOnboardingModalProps) {
  const { state, setTheme, setThemeStyle, updateSettings } = useAppState();
  const t = getTranslations(state.settings.language || "en");
  const isDesktopRuntime = state.appRuntime === "desktop" || state.appRuntime === "tauri";
  const viewMode = state.settings.desktopViewMode ?? "focus";

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

        <div className="theme-onboarding-card__section theme-onboarding-card__section--language">
          <label className="settings-item__title" htmlFor="themeOnboardingLanguage">
            {t.onboarding.language}
          </label>
          <select
            id="themeOnboardingLanguage"
            className="theme-onboarding-card__select"
            value={state.settings.language || "en"}
            onChange={(event) => updateSettings({ language: event.target.value as AppLanguage })}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
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

        {isDesktopRuntime && (
          <div className="theme-onboarding-card__section theme-onboarding-card__section--view">
            <div className="settings-item__title">{t.onboarding.viewMode}</div>
            <div
              className="segmented-control segmented-control--two"
              role="radiogroup"
              aria-label={t.onboarding.viewMode}
            >
              {(["focus", "tabs"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`segmented-option${viewMode === id ? " is-active" : ""}`}
                  aria-pressed={viewMode === id}
                  onClick={() => updateSettings({ desktopViewMode: id })}
                >
                  {id === "focus" ? t.focus : t.tabs}
                </button>
              ))}
            </div>
            <p className="theme-onboarding-card__section-desc">
              {viewMode === "tabs" ? t.onboarding.viewModeTabsDesc : t.onboarding.viewModeFocusDesc}
            </p>
          </div>
        )}

        <div className="theme-onboarding-card__hint">
          <span>{t.onboarding.settingsHint}</span>
          <button
            type="button"
            className="btn theme-onboarding-card__open-settings"
            onClick={onOpenSettings}
          >
            {t.onboarding.openSettings}
          </button>
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
