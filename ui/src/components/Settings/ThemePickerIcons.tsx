import type { PetThemeStyle, ThemeStyle } from "../../types";
import nikaPet from "../../assets/themes/pets/backgrounds/nika-happy.png";
import kInkPet from "../../assets/themes/pets/backgrounds/k-ink-wolf.png";

export type BuiltInThemeStyle = Exclude<ThemeStyle, PetThemeStyle>;

export const PET_IMAGE_URLS: Record<PetThemeStyle, string> = {
  "pet-white-shiba": nikaPet,
  "pet-k-ink": kInkPet,
};

export function PetImageSwatch({ themeStyle }: { themeStyle: PetThemeStyle }) {
  return (
    <img
      className="pet-theme-swatch-image"
      src={PET_IMAGE_URLS[themeStyle]}
      alt=""
      draggable={false}
    />
  );
}

export function ThemeIcon({ themeStyle, size = 18 }: { themeStyle: BuiltInThemeStyle; size?: number }) {
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
    case "cyberpunk":
      return (
        <svg className="theme-option-icon theme-option-icon--cyberpunk" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="4,3 17,3 20,6 20,21 7,21 4,18" fill="currentColor" fillOpacity="0.15" />
          <line x1="8" y1="8" x2="16" y2="8" strokeWidth="1.6" />
          <line x1="8" y1="12" x2="14" y2="12" strokeWidth="1.6" opacity="0.75" />
          <line x1="8" y1="16" x2="12" y2="16" strokeWidth="1.6" opacity="0.5" />
          <rect x="17" y="15" width="2" height="2" fill="currentColor" stroke="none" />
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

export function Chevron() {
  return (
    <span className="pet-theme-select__chevron" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
