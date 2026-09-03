import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { INSIGHTS_UI_TRANSLATIONS } from '../../contexts/insightsUiTranslations';
import { resolveInsightsSettings, type InsightsSettingsInput, type InsightsWorkspaceOverrides } from '../../insights/config';
import { INSIGHTS_SETTINGS_CHANGED_EVENT, loadInsightsSettingsConfig, resetWorkspaceInsightsSettings, saveInsightsSettingsConfig, updateGlobalInsightsSettings, updateWorkspaceInsightsSettings } from '../../insights/settingsStore';
import { useWorkspaceInsights } from '../../insights/useWorkspaceInsights';
import { WorkspaceInsightsPanel } from './WorkspaceInsightsPanel';

export function WorkspaceInsightsEntry() {
  const { state } = useAppState();
  const bridge = usePlatform();
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [insightsConfig, setInsightsConfig] = useState(() => loadInsightsSettingsConfig());
  const workspaceKey = state.workspacePath || state.workspaceName || null;
  const language = state.settings.language as keyof typeof INSIGHTS_UI_TRANSLATIONS;
  const labels = INSIGHTS_UI_TRANSLATIONS[language] ?? INSIGHTS_UI_TRANSLATIONS.en;
  const workspaceOverrides = useMemo<InsightsWorkspaceOverrides>(() => workspaceKey ? insightsConfig.workspaceOverrides[workspaceKey] ?? {} : {}, [insightsConfig.workspaceOverrides, workspaceKey]);
  const globalSettings = useMemo(() => resolveInsightsSettings(insightsConfig.globalDefaults, {}), [insightsConfig.globalDefaults]);
  const settings = useMemo(() => resolveInsightsSettings(insightsConfig.globalDefaults, workspaceOverrides), [insightsConfig.globalDefaults, workspaceOverrides]);
  const session = useWorkspaceInsights({ bridge, workspaceKey, settings: insightsConfig.globalDefaults, workspaceOverrides });
  useEffect(() => { setPortalTarget(document.querySelector('.body')); }, [workspaceKey, state.sidebarCollapsed]);
  useEffect(() => { const reload = () => setInsightsConfig(loadInsightsSettingsConfig()); window.addEventListener(INSIGHTS_SETTINGS_CHANGED_EVENT, reload); return () => window.removeEventListener(INSIGHTS_SETTINGS_CHANGED_EVENT, reload); }, []);
  const updateGlobalSettings = (patch: InsightsSettingsInput) => { setInsightsConfig(current => saveInsightsSettingsConfig(updateGlobalInsightsSettings(current, patch))); };
  const updateWorkspaceSettings = (patch: InsightsWorkspaceOverrides) => { if (!workspaceKey) return; setInsightsConfig(current => saveInsightsSettingsConfig(updateWorkspaceInsightsSettings(current, workspaceKey, patch))); };
  const resetWorkspaceOverrides = () => { if (!workspaceKey) return; setInsightsConfig(current => saveInsightsSettingsConfig(resetWorkspaceInsightsSettings(current, workspaceKey))); };

  return <><button type="button" className={`sidebar__insights-btn${session.panelOpen ? ' is-active' : ''}`} aria-label={labels.title} aria-pressed={session.panelOpen} onClick={() => void session.open()}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/></svg><span>{labels.entry}</span></button>{portalTarget && session.panelOpen && createPortal(<><div className="insights-resize" id="insightsResize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={labels.title}/><WorkspaceInsightsPanel session={session} labels={labels} settings={settings} globalSettings={globalSettings} onGlobalSettingsChange={updateGlobalSettings} onSettingsChange={updateWorkspaceSettings} onResetWorkspaceOverrides={resetWorkspaceOverrides}/></>, portalTarget)}</>;
}
