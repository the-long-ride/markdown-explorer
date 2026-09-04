import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { INSIGHTS_UI_TRANSLATIONS } from '../../contexts/insightsUiTranslations';
import { resolveInsightsSettings, type InsightsSettingsInput, type InsightsWorkspaceOverrides } from '../../insights/config';
import { INSIGHTS_SETTINGS_CHANGED_EVENT, loadInsightsSettingsConfig, resetWorkspaceInsightsSettings, saveInsightsSettingsConfig, updateGlobalInsightsSettings, updateWorkspaceInsightsSettings } from '../../insights/settingsStore';
import { useWorkspaceInsights } from '../../insights/useWorkspaceInsights';
import { WORKSPACE_INSIGHTS_TOGGLE_EVENT } from '../shared/ToolbarActionMenu';
import { WorkspaceInsightsPanel } from './WorkspaceInsightsPanel';
import { jumpToLintLocation, type JumpLocation } from '../../insights/jumpToLocation';
import type { MediaGallery } from '../Modal/mediaGallery';

export interface WorkspaceInsightsEntryProps {
  onPanelOpenChange?: (open: boolean) => void;
  onOpenMedia?: (gallery: MediaGallery) => void;
}

export function WorkspaceInsightsEntry({ onPanelOpenChange, onOpenMedia }: WorkspaceInsightsEntryProps = {}) {
  const { state, navigate } = useAppState();
  const bridge = usePlatform();
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [insightsConfig, setInsightsConfig] = useState(() => loadInsightsSettingsConfig());
  const workspaceKey = state.workspacePath || state.workspaceName || null;
  const language = state.settings.language as keyof typeof INSIGHTS_UI_TRANSLATIONS;
  const labels = INSIGHTS_UI_TRANSLATIONS[language] ?? INSIGHTS_UI_TRANSLATIONS.en;
  const workspaceOverrides = useMemo<InsightsWorkspaceOverrides>(() => workspaceKey ? insightsConfig.workspaceOverrides[workspaceKey] ?? {} : {}, [insightsConfig.workspaceOverrides, workspaceKey]);
  const globalSettings = useMemo(() => resolveInsightsSettings(insightsConfig.globalDefaults, {}), [insightsConfig.globalDefaults]);
  const settings = useMemo(() => resolveInsightsSettings(insightsConfig.globalDefaults, workspaceOverrides), [insightsConfig.globalDefaults, workspaceOverrides]);
  const session = useWorkspaceInsights({ bridge, workspaceKey, workspaceOperationId: (state as any).workspaceOperationId, settings: insightsConfig.globalDefaults, workspaceOverrides });
  useEffect(() => { setPortalTarget(document.querySelector('.body')); }, [workspaceKey, state.sidebarCollapsed]);
  useEffect(() => { const reload = () => setInsightsConfig(loadInsightsSettingsConfig()); window.addEventListener(INSIGHTS_SETTINGS_CHANGED_EVENT, reload); return () => window.removeEventListener(INSIGHTS_SETTINGS_CHANGED_EVENT, reload); }, []);
  useEffect(() => { onPanelOpenChange?.(session.panelOpen); }, [onPanelOpenChange, session.panelOpen]);
  useEffect(() => {
    const handleToggle = () => {
      if (session.panelOpen) session.closePanel();
      else void session.open();
    };
    window.addEventListener(WORKSPACE_INSIGHTS_TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(WORKSPACE_INSIGHTS_TOGGLE_EVENT, handleToggle);
  }, [session]);
  const updateGlobalSettings = (patch: InsightsSettingsInput) => { setInsightsConfig(current => saveInsightsSettingsConfig(updateGlobalInsightsSettings(current, patch))); };
  const updateWorkspaceSettings = (patch: InsightsWorkspaceOverrides) => { if (!workspaceKey) return; setInsightsConfig(current => saveInsightsSettingsConfig(updateWorkspaceInsightsSettings(current, workspaceKey, patch))); };
  const resetWorkspaceOverrides = () => { if (!workspaceKey) return; setInsightsConfig(current => saveInsightsSettingsConfig(resetWorkspaceInsightsSettings(current, workspaceKey))); };

  const handleSelectPath = (path: string, location?: JumpLocation) => {
    const target = path.replace(/\\/g, '/').toLowerCase();
    const match = state.fileList.find(f => {
      const rel = f.relativePath.replace(/\\/g, '/').toLowerCase();
      const fs = f.fsPath.replace(/\\/g, '/').toLowerCase();
      return rel === target || fs === target || rel.endsWith(target) || target.endsWith(rel);
    });
    const dest = match ? match.fsPath : path;
    navigate(dest);
    if (location && (location.line !== undefined || location.sourceStart !== undefined)) {
      jumpToLintLocation(dest, location);
    }
  };

  if (!state.settings.insightsEnabled) return null;

  return (
    <>
      {portalTarget && session.panelOpen && createPortal(
        <>
          <div className="insights-resize" id="insightsResize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={labels.title}/>
          <WorkspaceInsightsPanel session={session} labels={labels} settings={settings} globalSettings={globalSettings} onGlobalSettingsChange={updateGlobalSettings} onSettingsChange={updateWorkspaceSettings} onResetWorkspaceOverrides={resetWorkspaceOverrides} onSelectPath={handleSelectPath} onOpenMedia={onOpenMedia}/>
        </>,
        portalTarget
      )}
    </>
  );
}
