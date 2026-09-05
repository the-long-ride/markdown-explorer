import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopTypographySettings } from '../../../../ui/src/components/Settings/DesktopTypographySettings.tsx';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext.tsx';
import { getTranslations } from '../../../../ui/src/contexts/translations.ts';
import { DEFAULT_DESKTOP_FONT_BINDINGS } from '../../../../ui/src/desktop/fonts/fontModel.ts';
import type { AppState } from '../../../../ui/src/contexts/appStateReducer.ts';
import type { DesktopFontFamily } from '../../../../ui/src/desktop/fonts/fontModel.ts';

describe('DesktopTypographySettings', () => {
  const t = getTranslations('en');

  const mockFonts: DesktopFontFamily[] = [
    {
      id: 'custom_1',
      family: 'Custom Sans',
      source: 'imported',
      cssFamily: 'Custom Sans',
      available: true,
      faces: [
        { style: 'normal', minWeight: 400, maxWeight: 400, variable: false },
        { style: 'italic', minWeight: 700, maxWeight: 700, variable: false },
      ],
    },
    {
      id: 'system_1',
      family: 'Arial',
      source: 'system',
      cssFamily: 'Arial',
      available: true,
      faces: [{ style: 'normal', minWeight: 400, maxWeight: 400, variable: false }],
    },
  ];

  function createMockState(overrides: Partial<AppState> = {}): AppState {
    return {
      settings: {
        fontBindings: { ...DEFAULT_DESKTOP_FONT_BINDINGS },
      },
      desktopFonts: mockFonts,
      desktopFontsResult: null,
      desktopFontError: null,
      ...overrides,
    } as unknown as AppState;
  }

  function renderComponent(state: AppState, updateSettings = vi.fn()) {
    const postMessage = vi.fn();
    const bridge = { postMessage } as any;

    const utils = render(
      <PlatformProvider bridge={bridge}>
        <DesktopTypographySettings
          state={state}
          t={t}
          updateSettings={updateSettings}
        />
      </PlatformProvider>,
    );

    return { ...utils, postMessage, updateSettings };
  }

  it('renders all typography role headings and initial default font descriptions', () => {
    const state = createMockState();
    renderComponent(state);

    expect(screen.getByText(t.appUiFont)).toBeInTheDocument();
    expect(screen.getByText(t.bodyFont)).toBeInTheDocument();
    expect(screen.getByText(t.headingFont)).toBeInTheDocument();
    expect(screen.getByText(t.quoteFont)).toBeInTheDocument();
    expect(screen.getByText(t.codeFont)).toBeInTheDocument();
    expect(screen.getByText(t.mermaidFont)).toBeInTheDocument();
  });

  it('triggers font import message to platform bridge', () => {
    const state = createMockState();
    const { postMessage } = renderComponent(state);

    const importButtons = screen.getAllByRole('button', { name: t.fontImport });
    fireEvent.click(importButtons[0]);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'importDesktopFonts',
        requestId: expect.stringMatching(/^import-font-appUi/),
      }),
    );
  });

  it('resets a single role back to default bindings', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          body: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        },
      } as any,
    });
    renderComponent(state);

    const resetRoleButtons = screen.getAllByRole('button', { name: t.fontResetRole });
    fireEvent.click(resetRoleButtons[1]); // Body role reset

    // Reset All should now be disabled since all match default
    const applyButton = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    expect(applyButton).not.toBeDisabled();
  });

  it('opens confirmation modal on Apply and updates settings on confirm', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          heading: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        },
      } as any,
    });
    const { updateSettings } = renderComponent(state);

    // Reset All fonts
    const resetAllBtn = screen.getByRole('button', { name: t.fontResetAll });
    fireEvent.click(resetAllBtn);

    // Apply button becomes enabled
    const applyBtn = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    expect(applyBtn).not.toBeDisabled();
    fireEvent.click(applyBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('dialog', { name: t.fontApplyConfirmTitle })).toBeInTheDocument();

    // Confirm apply
    const confirmBtn = screen.getByRole('button', { name: new RegExp(t.fontApplyChanges) });
    fireEvent.click(confirmBtn);

    expect(updateSettings).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: t.fontApplyConfirmTitle })).not.toBeInTheDocument();
  });

  it('cancels confirmation modal without applying changes', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          heading: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        },
      } as any,
    });
    const { updateSettings } = renderComponent(state);

    const resetAllBtn = screen.getByRole('button', { name: t.fontResetAll });
    fireEvent.click(resetAllBtn);

    const applyBtn = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    fireEvent.click(applyBtn);

    const cancelButtons = screen.getAllByRole('button', { name: t.cancelResetShortcuts });
    fireEvent.click(cancelButtons[0]);

    expect(updateSettings).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: t.fontApplyConfirmTitle })).not.toBeInTheDocument();
  });

  it('displays font error message when desktopFontError is set', () => {
    const state = createMockState({
      desktopFontError: 'Failed to read system fonts.',
    });
    renderComponent(state);

    expect(screen.getByRole('status')).toHaveTextContent('Failed to read system fonts.');
  });

  it('handles removal of imported fonts', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          quote: { source: 'imported', id: 'custom_1', family: 'Custom Sans', style: 'normal', weight: 400 },
        },
      } as any,
    });
    const { postMessage } = renderComponent(state);

    const removeBtn = screen.getByRole('button', { name: t.fontRemove });
    fireEvent.click(removeBtn);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'removeImportedDesktopFont',
        id: 'custom_1',
      }),
    );
  });
});
