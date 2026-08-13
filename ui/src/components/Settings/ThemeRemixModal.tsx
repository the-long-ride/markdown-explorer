import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { getTranslations } from "../../contexts/translations";
import { CUSTOM_THEME_COLOR_OPTIONS } from "../../theme/customThemes";
import type {
  CustomThemeScheme,
  ThemeMode,
  ThemeStyle,
} from "../../types";
import { CopyIcon, FolderIcon, PlusIcon, TrashIcon } from "../shared/icons";
import { TooltipButton } from "../shared/TooltipButton";
import { ThemeRemixDropdown } from './ThemeRemixDropdown';
import { useThemeRemixActions } from './useThemeRemixActions';
import { useThemeRemixStatus } from './useThemeRemixStatus';
import { BASE_STYLE_OPTIONS, DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS, formatRangeValue } from './themeRemixModel';
import { getThemeRemixBaseStyleLabels, getThemeRemixColorLabels, getThemeRemixDensityOptions, getThemeRemixImageFitOptions, getThemeRemixModeOptions } from './themeRemixTranslations';

interface ThemeRemixModalProps { isOpen: boolean; onClose: () => void; }

export function ThemeRemixModal({ isOpen, onClose }: ThemeRemixModalProps) {
  const {
    state,
    setThemeStyle,
    selectCustomTheme,
    updateSettings,
  } = useAppState();
  const t = getTranslations(state.settings.language);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(
    state.settings.activeCustomThemeId ?? state.settings.customThemes?.[0]?.id ?? null,
  );
  const [scheme, setScheme] = useState<CustomThemeScheme>("dark");
  const { status, statusKey, showStatus } = useThemeRemixStatus(isOpen);

  const customThemes = state.settings.customThemes ?? [];
  const baseStyleLabels = getThemeRemixBaseStyleLabels(t);
  const themeModeOptions = getThemeRemixModeOptions(t);
  const densityOptions = getThemeRemixDensityOptions(t);
  const imageFitOptions = getThemeRemixImageFitOptions(t);
  const colorLabels = getThemeRemixColorLabels(t);
  const selectedTheme = customThemes.find((theme) => theme.id === selectedThemeId) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedThemeId((current) =>
      current && customThemes.some((theme) => theme.id === current)
        ? current
        : state.settings.activeCustomThemeId ?? customThemes[0]?.id ?? null,
    );
  }, [customThemes, isOpen, state.settings.activeCustomThemeId]);

  const {
    canCreateTheme,
    handleCreateTheme,
    handleDuplicateTheme,
    handleDeleteTheme,
    handleApplySelectedTheme,
    handleColorChange,
    handleBackgroundFile,
    patchSelectedTheme,
  } = useThemeRemixActions({ state, customThemes, selectedTheme, selectedThemeId, setSelectedThemeId, selectCustomTheme, updateSettings, setThemeStyle, scheme, showStatus, copy: t.themeRemix });

  const schemeColors = useMemo(
    () => ({
      ...(scheme === "light" ? DEFAULT_LIGHT_COLORS : DEFAULT_DARK_COLORS),
      ...(selectedTheme?.colors?.[scheme] ?? {}),
    }),
    [scheme, selectedTheme],
  );

  if (!isOpen) return null;

  return (
    <div
      className="mdn-modal theme-remix-modal"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-card theme-remix-card">
        <TooltipButton
          className="settings-card__close"
          onClick={onClose}
          tooltip={t.themeRemix.close}
          tooltipPos="below"
          tooltipAlign="right"
        >
          &times;
        </TooltipButton>
        <div className="theme-remix-header">
          <div>
            <h2>{t.themeRemix.title}</h2>
            <p>{t.themeRemix.description}</p>
          </div>
        </div>

        {customThemes.length === 0 ? (
          <div className="theme-remix-empty-state">
            <button
              type="button"
              className="theme-remix-btn theme-remix-btn--accent theme-remix-empty-state__btn"
              onClick={handleCreateTheme}
              disabled={!canCreateTheme}
            >
              <PlusIcon size={15} />
              {t.themeRemix.newTheme}
            </button>
          </div>
        ) : (
          <div className="theme-remix-body">
            <aside className="theme-remix-list">
              <button
                type="button"
                className="theme-remix-btn theme-remix-btn--accent"
                onClick={handleCreateTheme}
                disabled={!canCreateTheme}
              >
                <PlusIcon size={14} />
                {t.themeRemix.newTheme}
              </button>
              <div className="theme-remix-list__items">
                {customThemes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`theme-remix-list__item${theme.id === selectedThemeId ? " is-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="theme-remix-list__select"
                      onClick={() => setSelectedThemeId(theme.id)}
                    >
                      <span className="theme-remix-list__name" title={theme.name}>{theme.name}</span>
                      <span className="theme-remix-list__meta" title={theme.baseStyle}>{theme.baseStyle}</span>
                    </button>
                    <div className="theme-remix-list__actions" role="group" aria-label={`${theme.name}: ${t.themeRemix.duplicate} / ${t.themeRemix.delete}`}>
                      <TooltipButton
                        type="button"
                        className="theme-remix-list__icon-btn"
                        tooltip={t.themeRemix.duplicate}
                        tooltipPos="below"
                        tooltipAlign="right"
                        onClick={() => handleDuplicateTheme(theme)}
                        disabled={!canCreateTheme}
                        icon={<CopyIcon size={14} />}
                      />
                      <TooltipButton
                        type="button"
                        className="theme-remix-list__icon-btn theme-remix-list__icon-btn--danger"
                        tooltip={t.themeRemix.delete}
                        tooltipPos="below"
                        tooltipAlign="right"
                        onClick={() => handleDeleteTheme(theme)}
                        icon={<TrashIcon size={14} />}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <section className="theme-remix-editor">
              {selectedTheme ? (
                <>
                <div className="theme-remix-section theme-remix-section--identity">
                  <label className="theme-remix-field">
                    <span>{t.themeRemix.name}</span>
                    <input
                      type="text"
                      value={selectedTheme.name}
                      maxLength={48}
                      onChange={(event) =>
                        patchSelectedTheme((theme) => ({ ...theme, name: event.target.value }))
                      }
                    />
                  </label>
                  <div className="theme-remix-field">
                    <span>{t.themeRemix.baseLayout}</span>
                    <ThemeRemixDropdown
                      ariaLabel={t.themeRemix.baseLayout}
                      value={selectedTheme.baseStyle}
                      options={BASE_STYLE_OPTIONS.map((option) => ({ value: option.id, label: baseStyleLabels[option.id] ?? option.id }))}
                      onChange={(value) =>
                        patchSelectedTheme((theme) => ({
                          ...theme,
                          baseStyle: value as ThemeStyle,
                        }))
                      }
                    />
                  </div>
                  <div className="theme-remix-field">
                    <span>{t.themeRemix.colorMode}</span>
                    <ThemeRemixDropdown
                      ariaLabel={t.themeRemix.colorMode}
                      value={selectedTheme.colorMode ?? "auto"}
                      options={themeModeOptions}
                      onChange={(value) =>
                        patchSelectedTheme((theme) => ({
                          ...theme,
                          colorMode: value as ThemeMode,
                        }))
                      }
                    />
                  </div>
                  <button type="button" className="theme-remix-btn theme-remix-btn--accent" onClick={handleApplySelectedTheme}>
                    {t.themeRemix.applyTheme}
                  </button>
                </div>

                <div className="theme-remix-layout-background">
                  <div className="theme-remix-section theme-remix-section--panel">
                    <div className="theme-remix-section__title">{t.themeRemix.layout}</div>
                    <div className="theme-remix-controls theme-remix-controls--stack">
                      <div className="theme-remix-field">
                        <span>{t.themeRemix.density}</span>
                        <ThemeRemixDropdown
                          ariaLabel={t.themeRemix.density}
                          value={selectedTheme.layout?.density ?? "comfortable"}
                          options={densityOptions}
                          onChange={(value) =>
                            patchSelectedTheme((theme) => ({
                              ...theme,
                              layout: {
                                ...(theme.layout ?? {}),
                                density: value,
                              },
                            }))
                          }
                        />
                      </div>
                      {([
                        { key: "radius", label: t.themeRemix.radius, min: 0, max: 18, unit: "px" },
                        { key: "strokeWidth", label: t.themeRemix.stroke, min: 0, max: 3, unit: "px" },
                        { key: "contentPadding", label: t.themeRemix.contentPadding, min: 16, max: 64, unit: "px" },
                        { key: "sectionGap", label: t.themeRemix.sectionGap, min: 4, max: 28, unit: "px" },
                      ] as const).map(({ key, label, min, max, unit }) => {
                        const value = Number(selectedTheme.layout?.[key] ?? min);
                        return (
                          <label className="theme-remix-field theme-remix-field--range" key={key}>
                            <span className="theme-remix-range-label">
                              <span>{label}</span>
                              <output>{formatRangeValue(value, unit)}</output>
                            </span>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              value={value}
                              onChange={(event) =>
                                patchSelectedTheme((theme) => ({
                                  ...theme,
                                  layout: {
                                    ...(theme.layout ?? {}),
                                    [key]: Number(event.target.value),
                                  },
                                }))
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="theme-remix-section theme-remix-section--panel">
                    <div className="theme-remix-section__title">{t.themeRemix.background}</div>
                    <div className="theme-remix-background">
                      <button type="button" className="theme-remix-btn" onClick={() => backgroundInputRef.current?.click()}>
                        <FolderIcon size={14} />
                        {t.themeRemix.chooseImage}
                      </button>
                      <button
                        type="button"
                        className="theme-remix-btn theme-remix-btn--danger"
                        onClick={() =>
                          patchSelectedTheme((theme) => ({
                            ...theme,
                            background: {
                              type: "none",
                              opacity: theme.background?.opacity ?? 0.16,
                              fit: theme.background?.fit ?? "cover",
                              position: theme.background?.position ?? "center",
                              blur: theme.background?.blur ?? 0,
                            },
                          }))
                        }
                      >
                        {t.themeRemix.removeImage}
                      </button>
                      <input
                        ref={backgroundInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        hidden
                        onChange={(event) => handleBackgroundFile(event.currentTarget.files?.[0])}
                      />
                    </div>
                    {selectedTheme.background?.type === "image" && selectedTheme.background.imageDataUrl && (
                      <div className="theme-remix-background-preview">
                        <img
                          src={selectedTheme.background.imageDataUrl}
                          alt={t.themeRemix.backgroundPreview.replace("{name}", selectedTheme.name)}
                          className={`theme-remix-background-preview__image theme-remix-background-preview__image--${selectedTheme.background.fit ?? "cover"}`}
                        />
                      </div>
                    )}
                    <div className="theme-remix-controls theme-remix-controls--stack">
                      <label className="theme-remix-field theme-remix-field--range theme-remix-field--image-opacity">
                        <span className="theme-remix-range-label">
                          <span>{t.themeRemix.imageOpacity}</span>
                          <output>{formatRangeValue(selectedTheme.background?.opacity ?? 0.16, "%")}</output>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="0.5"
                          step="0.01"
                          value={selectedTheme.background?.opacity ?? 0.16}
                          onChange={(event) =>
                            patchSelectedTheme((theme) => ({
                              ...theme,
                              background: { ...(theme.background ?? {}), opacity: Number(event.target.value) },
                            }))
                          }
                        />
                      </label>
                      <div className="theme-remix-field">
                        <span>{t.themeRemix.imageFit}</span>
                        <ThemeRemixDropdown
                          ariaLabel={t.themeRemix.imageFit}
                          value={selectedTheme.background?.fit ?? "cover"}
                          options={imageFitOptions}
                          onChange={(value) =>
                            patchSelectedTheme((theme) => ({
                              ...theme,
                              background: { ...(theme.background ?? {}), fit: value },
                            }))
                          }
                        />
                      </div>
                      <label className="theme-remix-field theme-remix-field--range">
                        <span className="theme-remix-range-label">
                          <span>{t.themeRemix.blur}</span>
                          <output>{formatRangeValue(selectedTheme.background?.blur ?? 0, "px")}</output>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="18"
                          value={selectedTheme.background?.blur ?? 0}
                          onChange={(event) =>
                            patchSelectedTheme((theme) => ({
                              ...theme,
                              background: { ...(theme.background ?? {}), blur: Number(event.target.value) },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="theme-remix-section">
                  <div className="theme-remix-section__title">{t.themeRemix.colors}</div>
                  <div className="theme-remix-tabs" role="tablist" aria-label={t.themeRemix.colorSchemes}>
                    {(["dark", "light"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={scheme === option ? "is-active" : ""}
                        onClick={() => setScheme(option)}
                      >
                        {option === "dark" ? t.dark : t.light}
                      </button>
                    ))}
                  </div>
                  <div className="theme-remix-color-grid">
                    {CUSTOM_THEME_COLOR_OPTIONS.map((option) => (
                      <label className="theme-remix-color" key={option.key}>
                        <span>{colorLabels[option.key] ?? option.key}</span>
                        <input
                          type="color"
                          value={schemeColors[option.key] ?? "#ffffff"}
                          onChange={(event) => handleColorChange(option.key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                </>
              ) : (
                <div className="theme-remix-empty theme-remix-empty--editor">
                  {t.themeRemix.unlockPrompt}
                </div>
              )}
            </section>
          </div>
        )}
        {status && (
          <div
            key={statusKey}
            className={`theme-remix-status theme-remix-status--${status.tone}`}
            role={status.tone === "error" ? "alert" : "status"}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
