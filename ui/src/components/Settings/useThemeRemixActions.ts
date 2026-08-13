import { useCallback } from 'react';
import { MAX_BACKGROUND_DATA_URL_LENGTH } from '../../theme/customThemes';
import type { AppState } from '../../contexts/appStateReducer';
import type { Translations } from '../../contexts/translationTypes';
import type { CustomTheme, CustomThemeColorOverrides, CustomThemeScheme } from '../../types';
import { DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS, createThemeFromCurrent, makeThemeId, normalizeHex, updateTheme } from './themeRemixModel';

interface ThemeRemixActionsArgs {
  state: AppState;
  customThemes: CustomTheme[];
  selectedTheme: CustomTheme | null;
  selectedThemeId: string | null;
  setSelectedThemeId: (id: string | null) => void;
  selectCustomTheme: (id: string | undefined) => void;
  updateSettings: (patch: Partial<AppState['settings']>) => void;
  setThemeStyle: (style: AppState['themeStyle']) => void;
  scheme: CustomThemeScheme;
  showStatus: (message: string, tone?: 'info' | 'error') => void;
  copy: Translations['themeRemix'];
}

export function useThemeRemixActions({
  state,
  customThemes,
  selectedTheme,
  selectedThemeId,
  setSelectedThemeId,
  selectCustomTheme,
  updateSettings,
  setThemeStyle,
  scheme,
  showStatus,
  copy,
}: ThemeRemixActionsArgs) {
  const canCreateTheme = customThemes.length < 24;
  const saveThemes = (themes: CustomTheme[], activeCustomThemeId = state.settings.activeCustomThemeId) =>
    updateSettings({ customThemes: themes, activeCustomThemeId });
  const patchSelectedTheme = (updater: (theme: CustomTheme) => CustomTheme) => {
    if (selectedTheme) saveThemes(updateTheme(customThemes, selectedTheme.id, updater));
  };

  const handleCreateTheme = useCallback(() => {
    if (!canCreateTheme) {
      showStatus(copy.customThemeLimit, 'error');
      return;
    }
    const theme = createThemeFromCurrent(copy.remixName.replace('{index}', String(customThemes.length + 1)));
    saveThemes([...customThemes, theme], theme.id);
    selectCustomTheme(theme.id);
    setSelectedThemeId(theme.id);
    showStatus(copy.createdTheme);
  }, [canCreateTheme, copy, customThemes, selectCustomTheme, setSelectedThemeId, showStatus]);

  const handleDuplicateTheme = useCallback((themeToDuplicate = selectedTheme) => {
    if (!canCreateTheme || !themeToDuplicate) {
      if (!canCreateTheme) showStatus(copy.customThemeLimit, 'error');
      return;
    }
    const duplicate = {
      ...themeToDuplicate,
      id: makeThemeId(),
      name: `${themeToDuplicate.name} ${copy.copySuffix}`.slice(0, 48),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveThemes([...customThemes, duplicate], duplicate.id);
    selectCustomTheme(duplicate.id);
    setSelectedThemeId(duplicate.id);
    showStatus(copy.duplicatedTheme);
  }, [canCreateTheme, copy, customThemes, selectedTheme, selectCustomTheme, setSelectedThemeId, showStatus]);

  const handleDeleteTheme = useCallback((themeToDelete = selectedTheme) => {
    if (!themeToDelete) return;
    const nextThemes = customThemes.filter((theme) => theme.id !== themeToDelete.id);
    const nextActiveId = state.settings.activeCustomThemeId === themeToDelete.id
      ? undefined
      : state.settings.activeCustomThemeId;
    const nextSelectedId = selectedThemeId === themeToDelete.id
      ? nextThemes[0]?.id ?? null
      : selectedThemeId;
    saveThemes(nextThemes, nextActiveId);
    if (!nextActiveId) setThemeStyle(state.themeStyle);
    setSelectedThemeId(nextSelectedId);
    showStatus(copy.deletedTheme);
  }, [copy, customThemes, selectedTheme, selectedThemeId, setSelectedThemeId, setThemeStyle, showStatus, state.settings.activeCustomThemeId, state.themeStyle]);

  const handleApplySelectedTheme = useCallback(() => {
    if (!selectedTheme) return;
    selectCustomTheme(selectedTheme.id);
    showStatus(copy.appliedTheme);
  }, [copy.appliedTheme, selectedTheme, selectCustomTheme, showStatus]);

  const handleColorChange = useCallback((key: keyof CustomThemeColorOverrides, value: string) => {
    patchSelectedTheme((theme) => ({
      ...theme,
      colors: {
        ...theme.colors,
        [scheme]: {
          ...(theme.colors?.[scheme] ?? (scheme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_DARK_COLORS)),
          [key]: normalizeHex(value, '#ffffff'),
        },
      },
    }));
  }, [scheme, selectedTheme, customThemes]);

  const handleBackgroundFile = useCallback((file: File | undefined) => {
    if (!file || !selectedTheme) return;
    if (!file.type.startsWith('image/')) {
      showStatus(copy.chooseImageFile, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.length > MAX_BACKGROUND_DATA_URL_LENGTH) {
        showStatus(copy.imageTooLarge.replace('{size}', String(Math.round(file.size / 1024))), 'error');
        return;
      }
      patchSelectedTheme((theme) => ({
        ...theme,
        background: {
          ...(theme.background ?? {}),
          type: 'image',
          imageDataUrl: dataUrl,
          opacity: theme.background?.opacity ?? 0.16,
          fit: theme.background?.fit ?? 'cover',
          position: theme.background?.position ?? 'center',
          blur: theme.background?.blur ?? 0,
        },
      }));
      showStatus(copy.backgroundImageAdded);
    };
    reader.readAsDataURL(file);
  }, [copy, selectedTheme, customThemes, scheme, showStatus]);

  return {
    canCreateTheme,
    handleCreateTheme,
    handleDuplicateTheme,
    handleDeleteTheme,
    handleApplySelectedTheme,
    handleColorChange,
    handleBackgroundFile,
    patchSelectedTheme,
  };
}
