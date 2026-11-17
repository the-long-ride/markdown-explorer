export type WelcomeTabId = 'features' | 'manual' | 'shortcuts' | 'privacy' | 'tips';

export const WELCOME_SELECT_TAB_EVENT = 'markdown-explorer-welcome-select-tab';

let lastRequestedWelcomeTab: WelcomeTabId | null = null;

export function getLastRequestedWelcomeTab(): WelcomeTabId | null {
  return lastRequestedWelcomeTab;
}

export function requestWelcomeTabSelect(tab: WelcomeTabId): void {
  lastRequestedWelcomeTab = tab;
  window.dispatchEvent(new CustomEvent<WelcomeTabId>(WELCOME_SELECT_TAB_EVENT, { detail: tab }));
}
