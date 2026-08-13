import type { Translations } from '../../contexts/translationTypes';

export function getThemeRemixBaseStyleLabels(t: Translations): Record<string, string> {
  return {
    default: t.themeStyles.defaultLabel,
    bento: t.themeStyles.bentoLabel,
    vercel: t.themeStyles.vercelLabel,
    "tokyo-night": t.themeStyles.tokyoNightLabel,
    "neon-voltage": t.themeStyles.neonVoltageLabel,
    "raw-grid": t.themeStyles.rawGridLabel,
    "pet-white-shiba": t.themeStyles.whiteShibaLabel,
    "pet-k-ink": t.themeStyles.kInkLabel,
    "pet-cat": t.themeStyles.catLabel,
    "pet-hamster": t.themeStyles.hamsterLabel,
    "pet-corgi": t.themeStyles.corgiLabel,
  };
}

export function getThemeRemixModeOptions(t: Translations) {
  return [
    { value: 'auto', label: t.auto },
    { value: 'light', label: t.light },
    { value: 'dark', label: t.dark },
  ];
}

export function getThemeRemixDensityOptions(t: Translations) {
  return [
    { value: 'compact', label: t.themeRemix.compact },
    { value: 'comfortable', label: t.themeRemix.comfortable },
    { value: 'spacious', label: t.themeRemix.spacious },
  ] as const;
}

export function getThemeRemixImageFitOptions(t: Translations) {
  return [
    { value: 'cover', label: t.themeRemix.cover },
    { value: 'contain', label: t.themeRemix.contain },
  ] as const;
}

export function getThemeRemixColorLabels(t: Translations): Record<string, string> {
  return {
    accent: t.themeRemix.colorAccent,
    accentText: t.themeRemix.colorAccentText,
    bg: t.themeRemix.colorBg,
    surface: t.themeRemix.colorSurface,
    elevated: t.themeRemix.colorElevated,
    hover: t.themeRemix.colorHover,
    active: t.themeRemix.colorActive,
    code: t.themeRemix.colorCode,
    text: t.themeRemix.colorText,
    textMuted: t.themeRemix.colorTextMuted,
    textSoft: t.themeRemix.colorTextSoft,
    textSubtle: t.themeRemix.colorTextSubtle,
    border: t.themeRemix.colorBorder,
    borderStrong: t.themeRemix.colorBorderStrong,
    success: t.themeRemix.colorSuccess,
    danger: t.themeRemix.colorDanger,
    chart1: t.themeRemix.colorChart1,
    chart2: t.themeRemix.colorChart2,
    chart3: t.themeRemix.colorChart3,
    chart4: t.themeRemix.colorChart4,
  };
}
