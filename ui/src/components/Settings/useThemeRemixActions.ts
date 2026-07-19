import { useCallback } from 'react';
import { MAX_BACKGROUND_DATA_URL_LENGTH } from '../../theme/customThemes';
import type { AppState } from '../../contexts/appStateReducer';
import type { CustomTheme, CustomThemeColorOverrides, CustomThemeScheme } from '../../types';
import { DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS, createThemeFromCurrent, getBackgroundImageLimitMessage, makeThemeId, normalizeHex, updateTheme } from './themeRemixModel';

export function useThemeRemixActions({ state, customThemes, selectedTheme, selectedThemeId, setSelectedThemeId, selectCustomTheme, updateSettings, setThemeStyle, scheme, showStatus }: { state: AppState; customThemes: CustomTheme[]; selectedTheme: CustomTheme | null; selectedThemeId: string | null; setSelectedThemeId: (id: string | null) => void; selectCustomTheme: (id: string | undefined) => void; updateSettings: (patch: Partial<AppState['settings']>) => void; setThemeStyle: (style: AppState['themeStyle']) => void; scheme: CustomThemeScheme; showStatus: (message: string, tone?: 'info' | 'error') => void; }) {
  const canCreateTheme = customThemes.length < 24;
  const saveThemes = (themes: CustomTheme[], activeCustomThemeId = state.settings.activeCustomThemeId) => updateSettings({ customThemes: themes, activeCustomThemeId });
  const patchSelectedTheme = (updater: (theme: CustomTheme) => CustomTheme) => { if (selectedTheme) saveThemes(updateTheme(customThemes, selectedTheme.id, updater)); };
  const handleCreateTheme = useCallback(() => {
    if (!canCreateTheme) { showStatus('Custom theme limit reached.', 'error'); return; }
    const theme = createThemeFromCurrent(`Remix ${customThemes.length + 1}`);
    saveThemes([...customThemes, theme], theme.id); selectCustomTheme(theme.id); setSelectedThemeId(theme.id); showStatus('Created theme.');
  }, [canCreateTheme, customThemes, selectCustomTheme, setSelectedThemeId, showStatus]);
  const handleDuplicateTheme = useCallback((themeToDuplicate = selectedTheme) => {
    if (!canCreateTheme || !themeToDuplicate) { if (!canCreateTheme) showStatus('Custom theme limit reached.', 'error'); return; }
    const duplicate = { ...themeToDuplicate, id: makeThemeId(), name: `${themeToDuplicate.name} Copy`.slice(0, 48), createdAt: Date.now(), updatedAt: Date.now() };
    saveThemes([...customThemes, duplicate], duplicate.id); selectCustomTheme(duplicate.id); setSelectedThemeId(duplicate.id); showStatus('Duplicated theme.');
  }, [canCreateTheme, customThemes, selectedTheme, selectCustomTheme, setSelectedThemeId, showStatus]);
  const handleDeleteTheme = useCallback((themeToDelete = selectedTheme) => {
    if (!themeToDelete) return;
    const nextThemes = customThemes.filter((theme) => theme.id !== themeToDelete.id);
    const nextActiveId = state.settings.activeCustomThemeId === themeToDelete.id ? undefined : state.settings.activeCustomThemeId;
    const nextSelectedId = selectedThemeId === themeToDelete.id ? nextThemes[0]?.id ?? null : selectedThemeId;
    saveThemes(nextThemes, nextActiveId); if (!nextActiveId) setThemeStyle(state.themeStyle); setSelectedThemeId(nextSelectedId); showStatus('Deleted theme.');
  }, [customThemes, selectedTheme, selectedThemeId, setSelectedThemeId, setThemeStyle, showStatus, state.settings.activeCustomThemeId, state.themeStyle]);
  const handleApplySelectedTheme = useCallback(() => { if (selectedTheme) { selectCustomTheme(selectedTheme.id); showStatus('Applied theme.'); } }, [selectedTheme, selectCustomTheme, showStatus]);
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
    if (!file.type.startsWith('image/')) { showStatus('Choose an image file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { const dataUrl = String(reader.result || ''); if (dataUrl.length > MAX_BACKGROUND_DATA_URL_LENGTH) { showStatus(getBackgroundImageLimitMessage(file.size), 'error'); return; } patchSelectedTheme((theme) => ({ ...theme, background: { ...(theme.background ?? {}), type: 'image', imageDataUrl: dataUrl, opacity: theme.background?.opacity ?? 0.16, fit: theme.background?.fit ?? 'cover', position: theme.background?.position ?? 'center', blur: theme.background?.blur ?? 0 } })); showStatus('Background image added.'); };
    reader.readAsDataURL(file);
  }, [selectedTheme, customThemes, scheme, showStatus]);
  return { canCreateTheme, handleCreateTheme, handleDuplicateTheme, handleDeleteTheme, handleApplySelectedTheme, handleColorChange, handleBackgroundFile, patchSelectedTheme };
}
