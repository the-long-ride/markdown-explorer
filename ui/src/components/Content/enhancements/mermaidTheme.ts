export interface MermaidThemeTokens {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly mutedText: string;
  readonly border: string;
  readonly accent: string;
  readonly success: string;
  readonly danger: string;
  readonly chart1: string;
  readonly chart2: string;
  readonly chart3: string;
  readonly chart4: string;
}


export interface MermaidRgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface MermaidForegroundOptions {
  readonly fallbackFill?: string;
  readonly currentForeground?: string;
  readonly minimumContrast?: number;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseRgbChannel(value: string): number | null {
  const raw = value.trim();
  if (raw.endsWith('%')) {
    const percent = Number.parseFloat(raw.slice(0, -1));
    return Number.isFinite(percent) ? clampChannel((percent / 100) * 255) : null;
  }
  const numeric = Number.parseFloat(raw);
  return Number.isFinite(numeric) ? clampChannel(numeric) : null;
}

function parseAlpha(value: string | undefined): number | null {
  if (value === undefined) return 1;
  const raw = value.trim();
  if (raw.endsWith('%')) {
    const percent = Number.parseFloat(raw.slice(0, -1));
    return Number.isFinite(percent) ? clampAlpha(percent / 100) : null;
  }
  const numeric = Number.parseFloat(raw);
  return Number.isFinite(numeric) ? clampAlpha(numeric) : null;
}

export function parseMermaidColor(value: string | null | undefined): MermaidRgbColor | null {
  if (!value) return null;
  const color = value.trim().toLowerCase();
  if (!color || color === 'none' || color === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3 || raw.length === 4) {
      return {
        r: Number.parseInt(raw[0] + raw[0], 16),
        g: Number.parseInt(raw[1] + raw[1], 16),
        b: Number.parseInt(raw[2] + raw[2], 16),
        a: raw.length === 4 ? Number.parseInt(raw[3] + raw[3], 16) / 255 : 1,
      };
    }
    if (raw.length === 6 || raw.length === 8) {
      return {
        r: Number.parseInt(raw.slice(0, 2), 16),
        g: Number.parseInt(raw.slice(2, 4), 16),
        b: Number.parseInt(raw.slice(4, 6), 16),
        a: raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const functional = color.match(/^rgba?\((.+)\)$/);
  if (functional) {
    const pieces = functional[1].split(/[\s,\/]+/).filter(Boolean);
    if (pieces.length < 3) return null;
    const r = parseRgbChannel(pieces[0]);
    const g = parseRgbChannel(pieces[1]);
    const b = parseRgbChannel(pieces[2]);
    const a = parseAlpha(pieces[3]);
    if (r === null || g === null || b === null || a === null) return null;
    return { r, g, b, a };
  }
  return null;
}

function compositeForeground(color: MermaidRgbColor, background: MermaidRgbColor): MermaidRgbColor {
  const alpha = clampAlpha(color.a);
  return {
    r: color.r * alpha + background.r * (1 - alpha),
    g: color.g * alpha + background.g * (1 - alpha),
    b: color.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function relativeLuminance(color: MermaidRgbColor): number {
  const linear = (channel: number) => {
    const value = clampChannel(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

function resolveOpaqueColor(value: string, fallback = '#ffffff'): MermaidRgbColor | null {
  const parsed = parseMermaidColor(value);
  if (!parsed) return null;
  if (parsed.a >= 0.999) return { ...parsed, a: 1 };
  const background = parseMermaidColor(fallback);
  if (!background) return null;
  const opaqueBackground = background.a >= 0.999
    ? background
    : compositeForeground(background, { r: 255, g: 255, b: 255, a: 1 });
  return compositeForeground(parsed, opaqueBackground);
}

export function mermaidContrastRatio(foreground: string, background: string): number {
  const bg = resolveOpaqueColor(background);
  if (!bg) return 1;
  const fg = resolveOpaqueColor(foreground, background);
  if (!fg) return 1;
  const light = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const dark = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (light + 0.05) / (dark + 0.05);
}

export function chooseMermaidForeground(
  fill: string,
  candidates: readonly string[],
  options: MermaidForegroundOptions = {},
): string {
  const fallbackFill = options.fallbackFill || '#ffffff';
  const parsedFill = parseMermaidColor(fill);
  const effectiveFill = !parsedFill || parsedFill.a < 0.01 ? fallbackFill : fill;
  const minimumContrast = options.minimumContrast ?? 4.5;

  if (options.currentForeground && mermaidContrastRatio(options.currentForeground, effectiveFill) >= minimumContrast) {
    return options.currentForeground;
  }

  let best = candidates[0] || options.currentForeground || '#000000';
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = mermaidContrastRatio(candidate, effectiveFill);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= minimumContrast) return candidate;
  }
  return best;
}

const DARK_FALLBACK: MermaidThemeTokens = {
  background: '#15171b',
  surface: '#1d1f24',
  text: '#f4f5f7',
  mutedText: '#a8adb7',
  border: '#454a55',
  accent: '#8b5cf6',
  success: '#34d399',
  danger: '#f87171',
  chart1: '#8b5cf6',
  chart2: '#34d399',
  chart3: '#f59e0b',
  chart4: '#60a5fa',
};

const LIGHT_FALLBACK: MermaidThemeTokens = {
  background: '#ffffff',
  surface: '#f7f7f8',
  text: '#1f2328',
  mutedText: '#667085',
  border: '#c7cbd1',
  accent: '#7c3aed',
  success: '#16a34a',
  danger: '#dc2626',
  chart1: '#7c3aed',
  chart2: '#0f9f8f',
  chart3: '#d97706',
  chart4: '#2563eb',
};

function resolved(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return value || fallback;
}

export function readMermaidThemeTokens(
  doc: Pick<Document, 'documentElement' | 'defaultView'> | undefined,
  isDark: boolean,
): MermaidThemeTokens {
  const fallback = isDark ? DARK_FALLBACK : LIGHT_FALLBACK;
  if (!doc) return { ...fallback };
  const style = doc.defaultView?.getComputedStyle(doc.documentElement) as CSSStyleDeclaration | undefined;
  if (!style) return { ...fallback };
  return {
    background: resolved(style, '--bg', fallback.background),
    surface: resolved(style, '--bg-s', fallback.surface),
    text: resolved(style, '--tx', fallback.text),
    mutedText: resolved(style, '--tx2', fallback.mutedText),
    border: resolved(style, '--bd-s', fallback.border),
    accent: resolved(style, '--accent', fallback.accent),
    success: resolved(style, '--success', fallback.success),
    danger: resolved(style, '--danger', fallback.danger),
    chart1: resolved(style, '--chart-1', fallback.chart1),
    chart2: resolved(style, '--chart-2', fallback.chart2),
    chart3: resolved(style, '--chart-3', fallback.chart3),
    chart4: resolved(style, '--chart-4', fallback.chart4),
  };
}

interface MermaidAccessiblePalette {
  readonly backgroundText: string;
  readonly surfaceText: string;
  readonly surfaceBorder: string;
  readonly backgroundBorder: string;
  readonly structureAccent: string;
  readonly accentText: string;
  readonly neutralFills: readonly string[];
}

function mixMermaidColors(base: string, toward: string, amount: number): string {
  const baseColor = resolveOpaqueColor(base);
  const towardColor = resolveOpaqueColor(toward);
  if (!baseColor || !towardColor) return base;
  const ratio = Math.min(1, Math.max(0, amount));
  const channel = (from: number, to: number) => Math.round(from + (to - from) * ratio);
  return `rgb(${channel(baseColor.r, towardColor.r)}, ${channel(baseColor.g, towardColor.g)}, ${channel(baseColor.b, towardColor.b)})`;
}

function buildReadableNeutralFills(surface: string, text: string): string[] {
  const fills = [surface];
  for (const amount of [0.04, 0.08, 0.12, 0.16, 0.20]) {
    const candidate = mixMermaidColors(surface, text, amount);
    fills.push(mermaidContrastRatio(text, candidate) >= 4.5 ? candidate : fills[fills.length - 1]);
  }
  return fills;
}

function buildAccessiblePalette(tokens: MermaidThemeTokens): MermaidAccessiblePalette {
  const fixedCandidates = ['#111111', '#ffffff'];
  const surfaceText = chooseMermaidForeground(
    tokens.surface,
    [tokens.text, tokens.mutedText, ...fixedCandidates],
    { fallbackFill: tokens.background, minimumContrast: 4.5 },
  );
  const backgroundText = chooseMermaidForeground(
    tokens.background,
    [tokens.text, tokens.mutedText, ...fixedCandidates],
    { fallbackFill: tokens.surface, minimumContrast: 4.5 },
  );
  const surfaceBorder = chooseMermaidForeground(
    tokens.surface,
    [tokens.border, tokens.mutedText, surfaceText, ...fixedCandidates],
    { fallbackFill: tokens.background, minimumContrast: 3 },
  );
  const backgroundBorder = chooseMermaidForeground(
    tokens.background,
    [tokens.border, tokens.mutedText, backgroundText, ...fixedCandidates],
    { fallbackFill: tokens.surface, minimumContrast: 3 },
  );
  const structureAccent = chooseMermaidForeground(
    tokens.background,
    [tokens.accent, tokens.mutedText, backgroundText, ...fixedCandidates],
    { fallbackFill: tokens.surface, minimumContrast: 3 },
  );
  const accentText = chooseMermaidForeground(
    tokens.accent,
    [tokens.text, tokens.background, ...fixedCandidates],
    { fallbackFill: tokens.background, minimumContrast: 4.5 },
  );
  return {
    backgroundText,
    surfaceText,
    surfaceBorder,
    backgroundBorder,
    structureAccent,
    accentText,
    neutralFills: buildReadableNeutralFills(tokens.surface, surfaceText),
  };
}

export function buildMermaidThemeVariables(
  tokens: MermaidThemeTokens,
  isDark: boolean,
): Record<string, any> {
  const labelBackground = tokens.background;
  const sectionAlt = tokens.background;
  const accessible = buildAccessiblePalette(tokens);
  const [neutral1, neutral2, neutral3, neutral4, neutral5, neutral6] = accessible.neutralFills;
  return {
    background: tokens.background, mainBkg: tokens.surface,
    primaryColor: tokens.surface, primaryTextColor: accessible.surfaceText, primaryBorderColor: accessible.surfaceBorder,
    secondaryColor: tokens.surface, secondaryTextColor: accessible.surfaceText, secondaryBorderColor: accessible.surfaceBorder,
    tertiaryColor: sectionAlt, tertiaryTextColor: accessible.backgroundText, tertiaryBorderColor: accessible.backgroundBorder,
    lineColor: accessible.structureAccent, textColor: accessible.backgroundText, titleColor: accessible.backgroundText,
    edgeLabelBackground: labelBackground, clusterBkg: tokens.surface, clusterBorder: accessible.surfaceBorder, nodeBorder: accessible.surfaceBorder,
    actorBkg: tokens.surface, actorBorder: accessible.structureAccent, actorTextColor: accessible.surfaceText, actorLineColor: accessible.backgroundBorder,
    signalColor: accessible.backgroundBorder, signalTextColor: accessible.backgroundText,
    labelBoxBkgColor: tokens.surface, labelBoxBorderColor: accessible.surfaceBorder, labelTextColor: accessible.surfaceText, loopTextColor: accessible.backgroundText,
    noteBkgColor: tokens.surface, noteBorderColor: accessible.structureAccent, noteTextColor: accessible.surfaceText,
    activationBkgColor: tokens.surface, activationBorderColor: accessible.structureAccent, sequenceNumberColor: accessible.accentText,
    sectionBkgColor: tokens.surface, altSectionBkgColor: sectionAlt, sectionBkgColor2: sectionAlt,
    excludeBkgColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    attributeBackgroundColorOdd: tokens.surface, attributeBackgroundColorEven: sectionAlt, rowOdd: tokens.surface, rowEven: sectionAlt,
    taskBkgColor: tokens.surface, taskBorderColor: accessible.surfaceBorder, taskTextColor: accessible.surfaceText, taskTextOutsideColor: accessible.backgroundText, taskTextLightColor: accessible.accentText,
    activeTaskBkgColor: tokens.accent, activeTaskBorderColor: accessible.structureAccent,
    doneTaskBkgColor: tokens.success, doneTaskBorderColor: mermaidContrastRatio(tokens.success, tokens.background) >= 3 ? tokens.success : accessible.structureAccent,
    critBkgColor: tokens.danger, critBorderColor: mermaidContrastRatio(tokens.danger, tokens.background) >= 3 ? tokens.danger : accessible.structureAccent,
    todayLineColor: accessible.structureAccent, gridColor: accessible.backgroundBorder,
    commitLabelColor: accessible.surfaceText, commitLabelBackground: tokens.surface,
    git0: accessible.structureAccent, git1: accessible.backgroundBorder, git2: accessible.surfaceBorder, git3: accessible.backgroundText,
    tagLabelColor: accessible.surfaceText, tagLabelBackground: tokens.surface, tagLabelBorder: accessible.surfaceBorder,
    pie1: neutral1, pie2: neutral2, pie3: neutral3, pie4: neutral4, pie5: neutral5, pie6: neutral6,
    pieSectionTextColor: accessible.surfaceText, pieLegendTextColor: accessible.backgroundText, pieTitleTextColor: accessible.backgroundText,
    pieStrokeColor: accessible.surfaceBorder, pieOuterStrokeColor: accessible.backgroundBorder,
    cScale0: neutral1, cScale1: neutral2, cScale2: neutral3, cScale3: neutral4,
    cScaleLabel0: accessible.surfaceText, cScaleLabel1: accessible.surfaceText, cScaleLabel2: accessible.surfaceText, cScaleLabel3: accessible.surfaceText,
    archEdgeColor: accessible.structureAccent, archEdgeArrowColor: accessible.structureAccent,
    archGroupBorderColor: accessible.surfaceBorder, archGroupBorderWidth: '2px', archEdgeWidth: '2px',
    xyChart: {
      backgroundColor: tokens.background, titleColor: accessible.backgroundText, dataLabelColor: accessible.backgroundText,
      xAxisLabelColor: accessible.backgroundText, xAxisTitleColor: accessible.backgroundText, xAxisTickColor: accessible.backgroundBorder, xAxisLineColor: accessible.backgroundBorder,
      yAxisLabelColor: accessible.backgroundText, yAxisTitleColor: accessible.backgroundText, yAxisTickColor: accessible.backgroundBorder, yAxisLineColor: accessible.backgroundBorder,
      plotColorPalette: [accessible.structureAccent, accessible.backgroundBorder, accessible.backgroundText].join(', '),
    },
  };
}

export function buildMermaidC4ThemeConfig(tokens: MermaidThemeTokens): Record<string, string> {
  const accessible = buildAccessiblePalette(tokens);
  return {
    person_bg_color: tokens.surface, person_border_color: accessible.structureAccent,
    external_person_bg_color: tokens.background, external_person_border_color: accessible.backgroundBorder,
    system_bg_color: tokens.surface, system_border_color: accessible.surfaceBorder,
    system_db_bg_color: tokens.surface, system_db_border_color: accessible.surfaceBorder,
    system_queue_bg_color: tokens.surface, system_queue_border_color: accessible.surfaceBorder,
    external_system_bg_color: tokens.background, external_system_border_color: accessible.backgroundBorder,
    external_system_db_bg_color: tokens.background, external_system_db_border_color: accessible.backgroundBorder,
    external_system_queue_bg_color: tokens.background, external_system_queue_border_color: accessible.backgroundBorder,
    container_bg_color: tokens.surface, container_border_color: accessible.surfaceBorder,
    container_db_bg_color: tokens.surface, container_db_border_color: accessible.surfaceBorder,
    container_queue_bg_color: tokens.surface, container_queue_border_color: accessible.surfaceBorder,
    external_container_bg_color: tokens.background, external_container_border_color: accessible.backgroundBorder,
    external_container_db_bg_color: tokens.background, external_container_db_border_color: accessible.backgroundBorder,
    external_container_queue_bg_color: tokens.background, external_container_queue_border_color: accessible.backgroundBorder,
    component_bg_color: tokens.surface, component_border_color: accessible.surfaceBorder,
    component_db_bg_color: tokens.surface, component_db_border_color: accessible.surfaceBorder,
    component_queue_bg_color: tokens.surface, component_queue_border_color: accessible.surfaceBorder,
    external_component_bg_color: tokens.background, external_component_border_color: accessible.backgroundBorder,
    external_component_db_bg_color: tokens.background, external_component_db_border_color: accessible.backgroundBorder,
    external_component_queue_bg_color: tokens.background, external_component_queue_border_color: accessible.backgroundBorder,
  };
}
