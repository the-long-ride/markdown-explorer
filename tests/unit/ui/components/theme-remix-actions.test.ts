import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useThemeRemixActions } from '../../../../ui/src/components/Settings/useThemeRemixActions';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { MAX_BACKGROUND_DATA_URL_LENGTH } from '../../../../ui/src/theme/customThemes';
import type { CustomTheme, CustomThemeScheme } from '../../../../ui/src/types';

const copy = getTranslations('en').themeRemix;
const theme: CustomTheme = { id: 'theme-a', name: 'Amber', baseStyle: 'default', colorMode: 'auto', createdAt: 0, updatedAt: 0 };
const other = { ...theme, id: 'theme-b', name: 'Blue' };

function fixture(overrides: Partial<Parameters<typeof useThemeRemixActions>[0]> = {}) {
  const props = {
    state: { ...initialState, settings: { ...initialState.settings, activeCustomThemeId: theme.id } },
    customThemes: [theme, other], selectedTheme: theme, selectedThemeId: theme.id,
    setSelectedThemeId: vi.fn(), selectCustomTheme: vi.fn(), updateSettings: vi.fn<Parameters<typeof useThemeRemixActions>[0]['updateSettings']>(),
    setThemeStyle: vi.fn(), scheme: 'dark' as CustomThemeScheme, showStatus: vi.fn(), copy, ...overrides,
  };
  return { ...renderHook(useThemeRemixActions, { initialProps: props }), props };
}

describe('theme remix actions', () => {
  it('reports the theme limit when creating or duplicating would exceed it', () => {
    const themes = Array.from({ length: 24 }, (_, i) => ({ ...theme, id: `theme-${i}` }));
    const { result, props } = fixture({ customThemes: themes });
    expect(result.current.canCreateTheme).toBe(false);
    act(() => result.current.handleCreateTheme());
    act(() => result.current.handleDuplicateTheme(other));
    expect(props.showStatus).toHaveBeenCalledTimes(2);
    expect(props.showStatus).toHaveBeenLastCalledWith(copy.customThemeLimit, 'error');
    expect(props.updateSettings).not.toHaveBeenCalled();
  });

  it('skips actions without a selection, but accepts an explicit duplicate', () => {
    const { result, props } = fixture({ selectedTheme: null, selectedThemeId: null });
    act(() => {
      result.current.handleDuplicateTheme();
      result.current.handleDeleteTheme();
      result.current.handleApplySelectedTheme();
      result.current.handleColorChange('accent', '#000000');
      result.current.handleBackgroundFile(new File(['x'], 'bg.png', { type: 'image/png' }));
    });
    expect(props.updateSettings).not.toHaveBeenCalled();
    expect(props.showStatus).not.toHaveBeenCalled();
    act(() => result.current.handleDuplicateTheme(other));
    const duplicate = props.updateSettings.mock.calls[0][0].customThemes?.at(-1);
    expect(duplicate?.id).not.toBe(other.id);
    expect(duplicate?.name).toBe(`Blue ${copy.copySuffix}`);
    expect(props.selectCustomTheme).toHaveBeenCalledWith(duplicate?.id);
  });

  it('keeps the active and selected theme when deleting a different theme', () => {
    const { result, props } = fixture();
    act(() => result.current.handleDeleteTheme(other));
    expect(props.updateSettings).toHaveBeenCalledWith({ customThemes: [theme], activeCustomThemeId: theme.id });
    expect(props.setSelectedThemeId).toHaveBeenCalledWith(theme.id);
    expect(props.setThemeStyle).not.toHaveBeenCalled();
    act(() => result.current.handleApplySelectedTheme());
    expect(props.selectCustomTheme).toHaveBeenCalledWith(theme.id);
    expect(props.showStatus).toHaveBeenLastCalledWith(copy.appliedTheme);
  });

  it('returns to the builtin style after removing the only theme', () => {
    const { result, props } = fixture({ customThemes: [theme] });
    act(() => result.current.handleDeleteTheme());
    expect(props.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ customThemes: [] }));
    expect(props.setSelectedThemeId).toHaveBeenCalledWith(null);
    expect(props.setThemeStyle).toHaveBeenCalledWith(props.state.themeStyle);
  });

  it.each(['light', 'dark'] as const)('updates %s colors with normalization and preserves the other scheme', (scheme) => {
    const otherScheme = scheme === 'light' ? 'dark' : 'light';
    const selected = { ...theme, colors: { [otherScheme]: { accent: '#345678' } } };
    const { result, props, rerender } = fixture({ selectedTheme: selected, customThemes: [selected], scheme });
    act(() => result.current.handleColorChange('text', ' #AABBCC '));
    const updated = props.updateSettings.mock.calls[0][0].customThemes![0];
    expect(updated.colors?.[scheme]).toMatchObject({ text: '#aabbcc' });
    expect(updated.colors?.[otherScheme]).toEqual({ accent: '#345678' });
    rerender({ ...props, selectedTheme: updated, customThemes: [updated] });
    act(() => result.current.handleColorChange('text', 'not a hex color'));
    expect(props.updateSettings.mock.calls[1][0].customThemes?.[0].colors?.[scheme]).toEqual({ ...updated.colors?.[scheme], text: '#ffffff' });
  });

  it('validates image background files and stores a supported one with default image settings', async () => {
    const { result, props } = fixture();
    act(() => result.current.handleBackgroundFile(undefined));
    expect(props.showStatus).not.toHaveBeenCalled();
    act(() => result.current.handleBackgroundFile(new File(['x'], 'bg.txt', { type: 'text/plain' })));
    expect(props.showStatus).toHaveBeenCalledWith(copy.chooseImageFile, 'error');
    expect(props.updateSettings).not.toHaveBeenCalled();
    act(() => result.current.handleBackgroundFile(new File(['PNG'], 'bg.png', { type: 'image/png' })));
    await waitFor(() => expect(props.showStatus).toHaveBeenLastCalledWith(copy.backgroundImageAdded));
    expect(props.updateSettings.mock.calls[0][0].customThemes?.[0].background).toEqual({
      type: 'image', imageDataUrl: 'data:image/png;base64,UE5H', opacity: 0.16, fit: 'cover', position: 'center', blur: 0,
    });
  });

  it('does not save oversized image data', async () => {
    const { result, props } = fixture();
    const largeImage = new File([new Uint8Array(MAX_BACKGROUND_DATA_URL_LENGTH)], 'large.png', { type: 'image/png' });
    act(() => result.current.handleBackgroundFile(largeImage));
    await waitFor(() => expect(props.showStatus).toHaveBeenCalledWith(
      copy.imageTooLarge.replace('{size}', String(Math.round(largeImage.size / 1024))), 'error',
    ));
    expect(props.updateSettings).not.toHaveBeenCalled();
  });
});
