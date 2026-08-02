import { TOC_COLLAPSED_STORAGE_KEY } from '../../constants/storage';
import { createEmptyUpdateState, type Action, type AppState } from '../appStateModel';
import { normalizeActiveCustomThemeId, normalizeCustomThemes } from '../../theme/customThemes';
import { createContentTabFromState, renderMarkdownClientSide, upsertContentTab } from '../contentTabState';

export type TocStorageWriter = (key: string, value: string) => void;

export function reduceSettingsUiAction(
  state: AppState,
  action: Action,
  writeTocStorage?: TocStorageWriter,
): AppState | null {
  switch (action.type) {
    case 'SET_UPDATE_STATE':
      return {
        ...state,
        updateState: {
          ...createEmptyUpdateState(),
          ...action.updateState,
        },
      };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'TOGGLE_TOC': {
      const nextCollapsed = !state.tocCollapsed;
      if (writeTocStorage) {
        try {
          writeTocStorage(TOC_COLLAPSED_STORAGE_KEY, String(nextCollapsed));
        } catch {}
      }
      return { ...state, tocCollapsed: nextCollapsed };
    }

    case 'SET_THEME':
      return { ...state, theme: action.theme, hasThemePreference: true };

    case 'SET_THEME_STYLE':
      return {
        ...state,
        themeStyle: action.themeStyle,
        hasThemeStylePreference: true,
        settings: { ...state.settings, activeCustomThemeId: undefined },
      };

    case 'SELECT_CUSTOM_THEME': {
      const customTheme = action.themeId
        ? state.settings.customThemes?.find((theme) => theme.id === action.themeId)
        : undefined;
      return {
        ...state,
        themeStyle: customTheme?.baseStyle ?? state.themeStyle,
        hasThemeStylePreference: customTheme ? true : state.hasThemeStylePreference,
        settings: {
          ...state.settings,
          activeCustomThemeId: customTheme?.id,
        },
      };
    }

    case 'UPDATE_SETTINGS': {
      const customThemes = action.settings.customThemes
        ? normalizeCustomThemes(action.settings.customThemes)
        : state.settings.customThemes;
      const activeCustomThemeId =
        'activeCustomThemeId' in action.settings || action.settings.customThemes
          ? normalizeActiveCustomThemeId(
              'activeCustomThemeId' in action.settings
                ? action.settings.activeCustomThemeId
                : state.settings.activeCustomThemeId,
              customThemes ?? [],
            )
          : state.settings.activeCustomThemeId;
      const activeCustomTheme = activeCustomThemeId
        ? customThemes?.find((theme) => theme.id === activeCustomThemeId)
        : undefined;
      const nextState = {
        ...state,
        themeStyle: activeCustomTheme?.baseStyle ?? state.themeStyle,
        hasThemeStylePreference: activeCustomTheme ? true : state.hasThemeStylePreference,
        settings: {
          ...state.settings,
          ...action.settings,
          customThemes,
          activeCustomThemeId,
        },
      };
      const previewDefaultsChanged = 'defaultHtmlCodeBlockPreview' in action.settings || 'defaultCsvPreview' in action.settings;
      if (previewDefaultsChanged) {
        const rerenderTab = (tab: AppState['contentTabs'][number]) => {
          if (!tab.markdownSource) return tab;
          const rendered = renderMarkdownClientSide(
            tab.markdownSource,
            tab.filePath,
            tab.filePath.endsWith('.mdx'),
            nextState.settings,
          );
          return { ...tab, contentHtml: rendered.html, frontmatter: rendered.frontmatter, toc: rendered.toc };
        };
        const contentTabs = nextState.contentTabs.map(rerenderTab);
        if (nextState.markdownSource) {
          const rendered = renderMarkdownClientSide(
            nextState.markdownSource,
            nextState.currentFile,
            nextState.currentFile?.endsWith('.mdx') ?? false,
            nextState.settings,
          );
          nextState.contentHtml = rendered.html;
          nextState.frontmatter = rendered.frontmatter;
          nextState.toc = rendered.toc;
          nextState.renderVersion += 1;
        }
        nextState.contentTabs = contentTabs;
      }
      if ('fileTabs' in action.settings) {
        if (action.settings.fileTabs === false) {
          return {
            ...nextState,
            contentTabs: [],
            activeContentTabPath: null,
          };
        }
        if (action.settings.fileTabs === true && !state.settings.fileTabs) {
          const currentTab = createContentTabFromState(nextState);
          return {
            ...nextState,
            contentTabs: currentTab
              ? upsertContentTab(state.contentTabs, currentTab)
              : state.contentTabs,
            activeContentTabPath: currentTab?.filePath ?? state.activeContentTabPath,
          };
        }
      }
      return nextState;
    }

    case 'SET_MAXIMIZED':
      return {
        ...state,
        isMaximized: action.isMaximized,
      };

    case 'TOGGLE_FOCUS_MODE':
      return {
        ...state,
        focusMode: !state.focusMode,
      };

    case 'SET_SIDEBAR_ACTIVE_TAB':
      return { ...state, sidebarActiveTab: action.tab };

    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.collapsed };

    default:
      return null;
  }
}
