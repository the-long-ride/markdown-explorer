// =============================================================================
// components/Settings/ThemeStylePicker.tsx — grouped appearance style picker
// =============================================================================

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PET_THEME_STYLE,
  PET_THEME_STYLE_OPTIONS,
  THEME_STYLE_OPTIONS,
  isPetThemeStyle,
} from "../../contexts/appStateConstants";
import type { PetThemeStyle, ThemeStyle } from "../../types";
import { useAppState } from "../../contexts/AppStateContext";
import { getTranslations } from "../../contexts/translations";
import whiteShibaPet from "../../assets/themes/pets/backgrounds/white-shiba-happy.png";
import kInkPet from "../../assets/themes/pets/backgrounds/k-ink-wolf.png";
import catPet from "../../assets/themes/pets/backgrounds/cat-happy.png";
import hamsterPet from "../../assets/themes/pets/backgrounds/hamster-happy.png";
import corgiPet from "../../assets/themes/pets/backgrounds/corgi-happy.png";

interface ThemeStylePickerProps {
  value: ThemeStyle;
  onChange: (themeStyle: ThemeStyle) => void;
  className?: string;
  showCustomThemes?: boolean;
  onOpenThemeRemix?: () => void;
}

type OpenGroup = "themes" | "pets" | "custom" | null;
type BuiltInThemeStyle = Exclude<ThemeStyle, PetThemeStyle>;

const PET_IMAGE_URLS: Record<PetThemeStyle, string> = {
  "pet-white-shiba": whiteShibaPet,
  "pet-k-ink": kInkPet,
  "pet-cat": catPet,
  "pet-hamster": hamsterPet,
  "pet-corgi": corgiPet,
};

function PetImageSwatch({ themeStyle }: { themeStyle: PetThemeStyle }) {
  return (
    <img
      className="pet-theme-swatch-image"
      src={PET_IMAGE_URLS[themeStyle]}
      alt=""
      draggable={false}
    />
  );
}

function ThemeIcon({ themeStyle, size = 18 }: { themeStyle: BuiltInThemeStyle; size?: number }) {
  switch (themeStyle) {
    case "bento":
      return (
        <svg className="theme-option-icon theme-option-icon--bento" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="10" rx="2" fill="currentColor" fillOpacity="0.12" />
          <rect x="13" y="3" width="8" height="6" rx="1.5" fill="currentColor" fillOpacity="0.12" />
          <rect x="13" y="11" width="8" height="10" rx="1.5" fill="currentColor" fillOpacity="0.12" />
          <rect x="3" y="15" width="8" height="6" rx="1.5" fill="currentColor" fillOpacity="0.12" />
        </svg>
      );
    case "vercel":
      return (
        <svg className="theme-option-icon theme-option-icon--vercel" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 4L21 19.5H3L12 4Z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case "tokyo-night":
      return (
        <svg className="theme-option-icon theme-option-icon--tokyo-night" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" fillOpacity="0.12" />
          <circle cx="17.5" cy="6" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "neon-voltage":
      return (
        <svg className="theme-option-icon theme-option-icon--neon-voltage" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case "raw-grid":
      return (
        <svg className="theme-option-icon theme-option-icon--raw-grid" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.08" />
          <line x1="3" y1="9" x2="21" y2="9" opacity="0.6" />
          <line x1="3" y1="15" x2="21" y2="15" opacity="0.6" />
          <line x1="9" y1="3" x2="9" y2="21" opacity="0.6" />
          <line x1="15" y1="3" x2="15" y2="21" opacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg className="theme-option-icon theme-option-icon--default" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.12" />
          <line x1="7" y1="8" x2="17" y2="8" strokeWidth="2" />
          <line x1="7" y1="12" x2="15" y2="12" opacity="0.75" />
          <line x1="7" y1="16" x2="12" y2="16" opacity="0.5" />
        </svg>
      );
  }
}

function Chevron() {
  return (
    <span className="pet-theme-select__chevron" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

export function ThemeStylePicker({
  value,
  onChange,
  className = "",
  showCustomThemes = false,
  onOpenThemeRemix,
}: ThemeStylePickerProps) {
  const { state, selectCustomTheme } = useAppState();
  const t = getTranslations(state.settings.language || "en");
  const [openGroup, setOpenGroup] = useState<OpenGroup>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const customThemes = state.settings.customThemes ?? [];
  const activeCustomTheme = state.settings.activeCustomThemeId
    ? customThemes.find((theme) => theme.id === state.settings.activeCustomThemeId)
    : undefined;

  const isPetSelected = isPetThemeStyle(value);
  const selectedPetTheme = isPetSelected ? value : DEFAULT_PET_THEME_STYLE;
  const selectedPetOption =
    PET_THEME_STYLE_OPTIONS.find((option) => option.id === selectedPetTheme) ??
    PET_THEME_STYLE_OPTIONS[0];
  const selectedBuiltIn = isPetSelected
    ? THEME_STYLE_OPTIONS[0]
    : THEME_STYLE_OPTIONS.find((option) => option.id === value) ?? THEME_STYLE_OPTIONS[0];

  const getThemeCopy = (themeStyle: BuiltInThemeStyle) => {
    switch (themeStyle) {
      case "bento":
        return { label: t.themeStyles.bentoLabel, desc: t.themeStyles.bentoDesc };
      case "vercel":
        return { label: t.themeStyles.vercelLabel, desc: t.themeStyles.vercelDesc };
      case "tokyo-night":
        return { label: t.themeStyles.tokyoNightLabel, desc: t.themeStyles.tokyoNightDesc };
      case "neon-voltage":
        return { label: t.themeStyles.neonVoltageLabel, desc: t.themeStyles.neonVoltageDesc };
      case "raw-grid":
        return { label: t.themeStyles.rawGridLabel, desc: t.themeStyles.rawGridDesc };
      default:
        return { label: t.themeStyles.defaultLabel, desc: t.themeStyles.defaultDesc };
    }
  };

  const getPetLabel = (themeStyle: PetThemeStyle) => {
    switch (themeStyle) {
      case "pet-k-ink":
        return t.themeStyles.kInkLabel;
      case "pet-cat":
        return t.themeStyles.catLabel;
      case "pet-hamster":
        return t.themeStyles.hamsterLabel;
      case "pet-corgi":
        return t.themeStyles.corgiLabel;
      default:
        return t.themeStyles.whiteShibaLabel;
    }
  };

  const selectedBuiltInCopy = getThemeCopy(selectedBuiltIn.id);

  useEffect(() => {
    if (!openGroup) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openGroup]);

  const selectBuiltIn = (themeStyle: BuiltInThemeStyle) => {
    onChange(themeStyle);
    setOpenGroup(null);
  };

  const selectPet = (themeStyle: PetThemeStyle) => {
    onChange(themeStyle);
    setOpenGroup(null);
  };

  const selectCustom = (themeId: string) => {
    selectCustomTheme(themeId);
    setOpenGroup(null);
  };

  return (
    <div ref={pickerRef} className={`theme-style-grid${className ? ` ${className}` : ""}`}>
      <div
        className={`theme-style-option theme-style-option--themes theme-style-option--${selectedBuiltIn.id}${
          !isPetSelected && !activeCustomTheme ? " is-active" : ""
        }`}
        data-theme-group="themes"
      >
        <button
          type="button"
          className="theme-style-option__main"
          aria-pressed={!isPetSelected && !activeCustomTheme}
          onClick={() => selectBuiltIn(selectedBuiltIn.id)}
        >
          <span className="theme-style-option__swatch" aria-hidden="true">
            <span className="theme-swatch-main"><ThemeIcon themeStyle={selectedBuiltIn.id} size={18} /></span>
            <span />
            <span />
          </span>
          <span className="theme-style-option__text">
            <span className="theme-style-option__label">{t.themeStyles.themesLabel}</span>
            <span className="theme-style-option__desc">{t.themeStyles.themesDesc}</span>
          </span>
        </button>
        <div className={`theme-group-dropdown${openGroup === "themes" ? " is-open" : ""}`}>
          <button
            type="button"
            className="theme-group-select"
            aria-haspopup="listbox"
            aria-expanded={openGroup === "themes"}
            onClick={() => setOpenGroup((group) => group === "themes" ? null : "themes")}
          >
            <span className="theme-group-select__label">{selectedBuiltInCopy.label || t.themeStyles.chooseTheme}</span>
            <Chevron />
          </button>
          <div className="theme-group-menu" role="listbox" aria-label={t.themeStyles.themesMenuLabel} hidden={openGroup !== "themes"}>
            {THEME_STYLE_OPTIONS.map((option) => {
              const copy = getThemeCopy(option.id);
              const selected = option.id === value && !activeCustomTheme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`theme-group-menu__option theme-group-menu__option--${option.id}${selected ? " is-selected" : ""}`}
                  onClick={() => selectBuiltIn(option.id)}
                >
                  <span className="theme-group-menu__swatch" aria-hidden="true">
                    <ThemeIcon themeStyle={option.id} size={16} />
                  </span>
                  <span className="theme-group-menu__copy">
                    <span className="theme-group-menu__label">{copy.label}</span>
                    <span className="theme-group-menu__desc">{copy.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`theme-style-option theme-style-option--pets theme-style-option--${selectedPetTheme}${isPetSelected ? " is-active" : ""}`}
        data-theme-group="pets"
      >
        <button type="button" className="theme-style-option__main" aria-pressed={isPetSelected} onClick={() => selectPet(selectedPetTheme)}>
          <span className="theme-style-option__swatch theme-style-option__swatch--pet" aria-hidden="true"><PetImageSwatch themeStyle={selectedPetTheme} /></span>
          <span className="theme-style-option__text">
            <span className="theme-style-option__label">{t.themeStyles.petsLabel}</span>
            <span className="theme-style-option__desc">{t.themeStyles.petsDesc}</span>
          </span>
        </button>
        <div className={`pet-theme-dropdown${openGroup === "pets" ? " is-open" : ""}`}>
          <button
            type="button"
            className="pet-theme-select"
            aria-haspopup="listbox"
            aria-expanded={openGroup === "pets"}
            onClick={() => setOpenGroup((group) => group === "pets" ? null : "pets")}
          >
            <span className="pet-theme-select__paw" aria-hidden="true" />
            <span className="pet-theme-select__label">{getPetLabel(selectedPetOption.id) || t.themeStyles.choosePetTheme}</span>
            <Chevron />
          </button>
          <div className="pet-theme-menu" role="listbox" aria-label={t.themeStyles.petsMenuLabel} hidden={openGroup !== "pets"}>
            {PET_THEME_STYLE_OPTIONS.map((option) => {
              const selected = option.id === selectedPetTheme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`pet-theme-menu__option pet-theme-menu__option--${option.id}${selected ? " is-selected" : ""}`}
                  onClick={() => selectPet(option.id)}
                >
                  <span className="pet-theme-menu__paw" aria-hidden="true" />
                  <span className="pet-theme-menu__label">{getPetLabel(option.id)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showCustomThemes && customThemes.length > 0 && (
        <div className={`theme-style-option theme-style-option--custom${activeCustomTheme ? " is-active" : ""}`} data-theme-group="custom">
          <span className="theme-style-option__swatch theme-style-option__swatch--custom" aria-hidden="true"><span /><span /><span /></span>
          <span className="theme-style-option__text">
            <span className="theme-style-option__label">{t.themeStyles.customThemesLabel}</span>
            <span className="theme-style-option__desc">{activeCustomTheme?.name ?? t.themeStyles.customThemesDesc}</span>
          </span>
          <div className={`custom-theme-dropdown${openGroup === "custom" ? " is-open" : ""}`}>
            <button
              type="button"
              className="custom-theme-select"
              aria-haspopup="listbox"
              aria-expanded={openGroup === "custom"}
              onClick={() => setOpenGroup((group) => group === "custom" ? null : "custom")}
            >
              <span className="custom-theme-select__label">{activeCustomTheme?.name ?? t.themeStyles.chooseCustomTheme}</span>
              <Chevron />
            </button>
            <div className="custom-theme-menu" role="listbox" aria-label={t.themeStyles.customThemesMenuLabel} hidden={openGroup !== "custom"}>
              {customThemes.map((theme) => {
                const selected = theme.id === activeCustomTheme?.id;
                return (
                  <button key={theme.id} type="button" role="option" aria-selected={selected} className={`custom-theme-menu__option${selected ? " is-selected" : ""}`} onClick={() => selectCustom(theme.id)}>
                    <span className="custom-theme-menu__swatch" aria-hidden="true" />
                    <span className="custom-theme-menu__label">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {onOpenThemeRemix && (
        <button type="button" className="theme-remix-launch-btn" onClick={onOpenThemeRemix}>
          {t.themeStyles.themeRemixLabel}
        </button>
      )}
    </div>
  );
}
