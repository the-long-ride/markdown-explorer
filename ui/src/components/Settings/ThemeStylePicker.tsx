// =============================================================================
// components/Settings/ThemeStylePicker.tsx — Appearance style picker
// =============================================================================

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PET_THEME_STYLE,
  PET_THEME_STYLE_OPTIONS,
  THEME_STYLE_OPTIONS,
  isPetThemeStyle,
} from "../../contexts/AppStateContext";
import type { PetThemeStyle, ThemeStyle } from "../../types";
import whiteShibaMascot from "../../assets/themes/pets/white-shiba.svg";
import shibaMascot from "../../assets/themes/pets/shiba.svg";
import kInkMascot from "../../assets/themes/pets/shiba-memes.svg";
import catMascot from "../../assets/themes/pets/cat.svg";
import hamsterMascot from "../../assets/themes/pets/hamster.svg";
import corgiMascot from "../../assets/themes/pets/corgi.svg";

interface ThemeStylePickerProps {
  value: ThemeStyle;
  onChange: (themeStyle: ThemeStyle) => void;
  className?: string;
}

const PETS_DESCRIPTION =
  "Vector mascots, patterned backgrounds, and soft animated reading surfaces.";

const PET_MASCOT_URLS: Record<PetThemeStyle, string> = {
  "pet-white-shiba": whiteShibaMascot,
  "pet-shiba": shibaMascot,
  "pet-shiba-memes": kInkMascot,
  "pet-cat": catMascot,
  "pet-hamster": hamsterMascot,
  "pet-corgi": corgiMascot,
};

function PetMascotSwatch({ themeStyle }: { themeStyle: PetThemeStyle }) {
  return (
    <img
      className="pet-theme-swatch-svg"
      src={PET_MASCOT_URLS[themeStyle]}
      alt=""
      draggable={false}
    />
  );
}

export function ThemeStylePicker({ value, onChange, className = "" }: ThemeStylePickerProps) {
  const isPetSelected = isPetThemeStyle(value);
  const selectedPetTheme = isPetSelected ? value : DEFAULT_PET_THEME_STYLE;
  const selectedPetOption =
    PET_THEME_STYLE_OPTIONS.find((option) => option.id === selectedPetTheme) ??
    PET_THEME_STYLE_OPTIONS[0];
  const [petMenuOpen, setPetMenuOpen] = useState(false);
  const petDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!petMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!petDropdownRef.current?.contains(event.target as Node)) {
        setPetMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPetMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [petMenuOpen]);

  const handlePetChange = (themeStyle: PetThemeStyle) => {
    onChange(themeStyle);
    setPetMenuOpen(false);
  };

  return (
    <div className={`theme-style-grid${className ? ` ${className}` : ""}`}>
      {THEME_STYLE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-style-option theme-style-option--${option.id}${
            value === option.id ? " is-active" : ""
          }`}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          <span className="theme-style-option__swatch" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="theme-style-option__text">
            <span className="theme-style-option__label">{option.label}</span>
            <span className="theme-style-option__desc">{option.description}</span>
          </span>
        </button>
      ))}

      <div
        className={`theme-style-option theme-style-option--pets theme-style-option--${selectedPetTheme}${
          isPetSelected ? " is-active" : ""
        }`}
      >
        <button
          type="button"
          className="theme-style-option__main"
          aria-pressed={isPetSelected}
          onClick={() => onChange(selectedPetTheme)}
        >
          <span className="theme-style-option__swatch theme-style-option__swatch--pet" aria-hidden="true">
            <PetMascotSwatch themeStyle={selectedPetTheme} />
          </span>
          <span className="theme-style-option__text">
            <span className="theme-style-option__label">Pets</span>
            <span className="theme-style-option__desc">{PETS_DESCRIPTION}</span>
          </span>
        </button>

        <div
          className={`pet-theme-dropdown${petMenuOpen ? " is-open" : ""}`}
          ref={petDropdownRef}
        >
          <button
            type="button"
            className="pet-theme-select"
            aria-haspopup="listbox"
            aria-expanded={petMenuOpen}
            onClick={() => setPetMenuOpen((open) => !open)}
          >
            <span className="pet-theme-select__paw" aria-hidden="true" />
            <span className="pet-theme-select__label">{selectedPetOption.label}</span>
            <span className="pet-theme-select__chevron" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
          <div
            className="pet-theme-menu"
            role="listbox"
            aria-label="Pet sub-theme"
            hidden={!petMenuOpen}
          >
            {PET_THEME_STYLE_OPTIONS.map((option) => {
              const isSelected = option.id === selectedPetTheme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`pet-theme-menu__option pet-theme-menu__option--${option.id}${
                    isSelected ? " is-selected" : ""
                  }`}
                  onClick={() => handlePetChange(option.id)}
                >
                  <span className="pet-theme-menu__paw" aria-hidden="true" />
                  <span className="pet-theme-menu__label">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
