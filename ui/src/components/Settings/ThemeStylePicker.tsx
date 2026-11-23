// =============================================================================
// components/Settings/ThemeStylePicker.tsx — grouped appearance style picker
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCssVars } from "../../utils/useCssVars";
import { executeThemeTransition } from "../../utils/themeTransition";
import {
  DEFAULT_PET_THEME_STYLE,
  PET_THEME_STYLE_OPTIONS,
  THEME_STYLE_OPTIONS,
  isPetThemeStyle,
} from "../../contexts/appStateConstants";
import type { PetThemeStyle, ThemeStyle } from "../../types";
import { useAppState } from "../../contexts/AppStateContext";
import { getTranslations } from "../../contexts/translations";
import {
  type BuiltInThemeStyle,
  Chevron,
  PetImageSwatch,
  ThemeIcon,
} from "./ThemePickerIcons";

interface ThemeStylePickerProps {
  value: ThemeStyle;
  onChange: (themeStyle: ThemeStyle) => void;
  className?: string;
  showCustomThemes?: boolean;
  onOpenThemeRemix?: () => void;
}

type OpenGroup = "themes" | "pets" | "custom" | null;

const MAX_VISIBLE_THEME_MENU_ITEMS = 7;

function getThemeMenuDesiredHeight(group: Exclude<OpenGroup, null>, itemCount: number) {
  const rowHeight = group === 'themes' ? 48 : 36;
  const items = Math.min(MAX_VISIBLE_THEME_MENU_ITEMS, Math.max(1, itemCount));
  return rowHeight * items + 10;
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
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeSelectRef = useRef<HTMLButtonElement>(null);
  const petSelectRef = useRef<HTMLButtonElement>(null);
  const customSelectRef = useRef<HTMLButtonElement>(null);
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
      case "cyberpunk":
        return { label: t.themeStyles.cyberpunkLabel || 'Cyberpunk', desc: t.themeStyles.cyberpunkDesc || 'Machined controls, cut-corner cyberdeck geometry, and signal yellow/vermilion accents.' };
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
      default:
        return t.themeStyles.whiteShibaLabel;
    }
  };

  const selectedBuiltInCopy = getThemeCopy(selectedBuiltIn.id);

  const activeTrigger = () => openGroup === "themes"
    ? themeSelectRef.current
    : openGroup === "pets"
      ? petSelectRef.current
      : openGroup === "custom"
        ? customSelectRef.current
        : null;

  const updateMenuPosition = () => {
    const rect = activeTrigger()?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const count = openGroup === "custom"
      ? customThemes.length
      : openGroup === "pets"
        ? PET_THEME_STYLE_OPTIONS.length
        : THEME_STYLE_OPTIONS.length;
    const desiredHeight = openGroup ? getThemeMenuDesiredHeight(openGroup, count) : 340;
    const roomBelow = window.innerHeight - rect.bottom - margin;
    const roomAbove = rect.top - margin;
    const openUp = roomBelow < Math.min(260, desiredHeight) && roomAbove > roomBelow;
    const maxHeight = openUp
      ? Math.max(80, Math.min(desiredHeight, roomAbove - 5))
      : Math.max(80, Math.min(desiredHeight, roomBelow - 5));
    const width = Math.max(220, rect.width);
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));

    if (openUp) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 5,
        left,
        width,
        maxHeight,
      });
    } else {
      setMenuPosition({
        top: rect.bottom + 5,
        left,
        width,
        maxHeight,
      });
    }
  };

  useLayoutEffect(() => {
    if (!openGroup) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [openGroup]);

  useEffect(() => {
    if (!openGroup) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpenGroup(null);
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

  const selectBuiltIn = (themeStyle: BuiltInThemeStyle, event?: React.MouseEvent<HTMLElement>) => {
    executeThemeTransition(() => onChange(themeStyle), {
      originElement: event?.currentTarget ?? pickerRef.current,
      event: event && 'clientX' in event && event.clientX > 0 ? event : undefined,
      themeStyle,
      nextTheme: state.theme,
    });
    setOpenGroup(null);
  };

  useCssVars(menuRef, menuPosition ? { '--menu-top': menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined, '--menu-bottom': menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined, '--menu-left': `${menuPosition.left}px`, '--menu-width': `${menuPosition.width}px`, '--menu-max-height': `${menuPosition.maxHeight}px` } : {});

  const selectPet = (themeStyle: PetThemeStyle, event?: React.MouseEvent<HTMLElement>) => {
    executeThemeTransition(() => onChange(themeStyle), {
      originElement: event?.currentTarget ?? pickerRef.current,
      event: event && 'clientX' in event && event.clientX > 0 ? event : undefined,
      themeStyle,
      nextTheme: state.theme,
    });
    setOpenGroup(null);
  };

  const selectCustom = (themeId: string, event?: React.MouseEvent<HTMLElement>) => {
    const customTheme = customThemes.find((theme) => theme.id === themeId);
    executeThemeTransition(() => selectCustomTheme(themeId), {
      originElement: event?.currentTarget ?? pickerRef.current,
      event: event && 'clientX' in event && event.clientX > 0 ? event : undefined,
      themeStyle: customTheme?.baseStyle,
      nextTheme: customTheme?.colorMode ?? state.theme,
    });
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
          onClick={(e) => selectBuiltIn(selectedBuiltIn.id, e)}
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
            ref={themeSelectRef}
            type="button"
            className="theme-group-select"
            aria-haspopup="listbox"
            aria-expanded={openGroup === "themes"}
            onClick={() => setOpenGroup((group) => group === "themes" ? null : "themes")}
          >
            <span className="theme-group-select__label">{selectedBuiltInCopy.label || t.themeStyles.chooseTheme}</span>
            <Chevron />
          </button>
        </div>
      </div>

      <div
        className={`theme-style-option theme-style-option--pets theme-style-option--${selectedPetTheme}${isPetSelected ? " is-active" : ""}`}
        data-theme-group="pets"
      >
        <button type="button" className="theme-style-option__main" aria-pressed={isPetSelected} onClick={(e) => selectPet(selectedPetTheme, e)}>
          <span className="theme-style-option__swatch theme-style-option__swatch--pet" aria-hidden="true"><PetImageSwatch themeStyle={selectedPetTheme} /></span>
          <span className="theme-style-option__text">
            <span className="theme-style-option__label">{t.themeStyles.petsLabel}</span>
            <span className="theme-style-option__desc">{t.themeStyles.petsDesc}</span>
          </span>
        </button>
        <div className={`pet-theme-dropdown${openGroup === "pets" ? " is-open" : ""}`}>
          <button
            ref={petSelectRef}
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
              ref={customSelectRef}
              type="button"
              className="custom-theme-select"
              aria-haspopup="listbox"
              aria-expanded={openGroup === "custom"}
              onClick={() => setOpenGroup((group) => group === "custom" ? null : "custom")}
            >
              <span className="custom-theme-select__label">{activeCustomTheme?.name ?? t.themeStyles.chooseCustomTheme}</span>
              <Chevron />
            </button>
          </div>
        </div>
      )}


      {openGroup && menuPosition && createPortal(
        <div
          ref={menuRef}
          className={`${openGroup === "themes" ? "theme-group-menu" : openGroup === "pets" ? "pet-theme-menu" : "custom-theme-menu"} theme-picker-menu--portal`}
          role="listbox"
          aria-label={openGroup === "themes" ? t.themeStyles.themesMenuLabel : openGroup === "pets" ? t.themeStyles.petsMenuLabel : t.themeStyles.customThemesMenuLabel}
        >
          {openGroup === "themes" && THEME_STYLE_OPTIONS.map((option) => {
            const copy = getThemeCopy(option.id);
            const selected = option.id === value && !activeCustomTheme;
            return (
              <button key={option.id} type="button" role="option" aria-selected={selected} className={`theme-group-menu__option theme-group-menu__option--${option.id}${selected ? " is-selected" : ""}`} onClick={(e) => selectBuiltIn(option.id, e)}>
                <span className="theme-group-menu__swatch" aria-hidden="true"><ThemeIcon themeStyle={option.id} size={16} /></span>
                <span className="theme-group-menu__copy"><span className="theme-group-menu__label">{copy.label}</span><span className="theme-group-menu__desc">{copy.desc}</span></span>
              </button>
            );
          })}
          {openGroup === "pets" && PET_THEME_STYLE_OPTIONS.map((option) => {
            const selected = option.id === selectedPetTheme;
            return (
              <button key={option.id} type="button" role="option" aria-selected={selected} className={`pet-theme-menu__option pet-theme-menu__option--${option.id}${selected ? " is-selected" : ""}`} onClick={(e) => selectPet(option.id, e)}>
                <span className="pet-theme-menu__paw" aria-hidden="true" /><span className="pet-theme-menu__label">{getPetLabel(option.id)}</span>
              </button>
            );
          })}
          {openGroup === "custom" && customThemes.map((theme) => {
            const selected = theme.id === activeCustomTheme?.id;
            return (
              <button key={theme.id} type="button" role="option" aria-selected={selected} className={`custom-theme-menu__option${selected ? " is-selected" : ""}`} onClick={(e) => selectCustom(theme.id, e)}>
                <span className="custom-theme-menu__swatch" aria-hidden="true" /><span className="custom-theme-menu__label">{theme.name}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}

      {onOpenThemeRemix && (
        <button type="button" className="theme-remix-launch-btn" onClick={onOpenThemeRemix}>
          {t.themeStyles.themeRemixLabel}
        </button>
      )}
    </div>
  );
}
