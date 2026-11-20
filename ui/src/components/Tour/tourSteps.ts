import type { SidebarTabId } from '../../contexts/appStateModel';
import type { TourStage, WelcomeTabId } from './tourEvents';
import { getTourTranslations } from './tourTranslations';

export type TourStepId =
  | 'welcome'
  | 'launchpad'
  | 'manual'
  | 'workspaceSelection'
  | 'navigation'
  | 'sidebar'
  | 'reader'
  | 'toc'
  | 'insights'
  | 'settings';

export interface TourStepDefinition {
  id: TourStepId;
  stage: TourStage;
  targetSelector: string;
  welcomeTab?: WelcomeTabId;
  sidebarTab?: SidebarTabId;
  ensureTocOpen?: boolean;
  openSettings?: boolean;
  badge: string;
  title: string;
  desc: string;
}

export function buildTourSteps(language = 'en', runtime = 'desktop'): TourStepDefinition[] {
  const t = getTourTranslations(language).steps;
  const homeSteps: TourStepDefinition[] = [
    {
      id: 'welcome',
      stage: 'home',
      targetSelector: '[data-tour-id="welcome-hero"], .workspace-selection__brand, .hero-section',
      welcomeTab: 'features',
      badge: t.welcome.badge,
      title: t.welcome.title,
      desc: t.welcome.desc,
    },
    {
      id: 'launchpad',
      stage: 'home',
      targetSelector: '[data-tour-id="welcome-launchpad"], .workspace-selection__actions',
      badge: t.launchpad.badge,
      title: t.launchpad.title,
      desc: t.launchpad.desc,
    },
    {
      id: 'manual',
      stage: 'home',
      targetSelector: '[data-tour-id="welcome-tabs-bar"], .tabs-bar, .workspace-selection__panel',
      welcomeTab: 'manual',
      badge: t.manual.badge,
      title: t.manual.title,
      desc: t.manual.desc,
    },
  ];

  if (runtime === 'desktop' || runtime === 'tauri') {
    return [
      ...homeSteps,
      {
        id: 'workspaceSelection',
        stage: 'selection',
        targetSelector: '.workspace-selection__panel, .workspace-selection__actions, .workspace-selection',
        badge: t.workspaceSelection.badge,
        title: t.workspaceSelection.title,
        desc: t.workspaceSelection.desc,
      },
      {
        id: 'settings',
        stage: 'selection',
        openSettings: true,
        targetSelector: '.settings-card, .workspace-selection__actions',
        badge: t.settings.badge,
        title: t.settings.title,
        desc: t.settings.desc,
      },
    ];
  }

  return [
    ...homeSteps,
    {
      id: 'navigation',
      stage: 'workspace',
      targetSelector: '.desktop-tabbar, .topbar',
      badge: t.navigation.badge,
      title: t.navigation.title,
      desc: t.navigation.desc,
    },
    {
      id: 'sidebar',
      stage: 'workspace',
      sidebarTab: 'files',
      targetSelector: '.sidebar',
      badge: t.sidebar.badge,
      title: t.sidebar.title,
      desc: t.sidebar.desc,
    },
    {
      id: 'reader',
      stage: 'workspace',
      targetSelector: '.content-shell, .content',
      badge: t.reader.badge,
      title: t.reader.title,
      desc: t.reader.desc,
    },
    {
      id: 'toc',
      stage: 'workspace',
      ensureTocOpen: true,
      targetSelector: '.toc-panel, .content-shell',
      badge: t.toc.badge,
      title: t.toc.title,
      desc: t.toc.desc,
    },
    {
      id: 'insights',
      stage: 'workspace',
      targetSelector: '.toolbar-action-menu, .desktop-tabbar__actions, .topbar__right',
      badge: t.insights.badge,
      title: t.insights.title,
      desc: t.insights.desc,
    },
    {
      id: 'settings',
      stage: 'workspace',
      openSettings: true,
      targetSelector: '.settings-card, .desktop-tabbar__actions, .topbar__right',
      badge: t.settings.badge,
      title: t.settings.title,
      desc: t.settings.desc,
    },
  ];
}
