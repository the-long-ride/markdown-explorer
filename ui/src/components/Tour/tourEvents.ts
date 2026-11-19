export {
  type WelcomeTabId,
  WELCOME_SELECT_TAB_EVENT,
  getLastRequestedWelcomeTab,
  requestWelcomeTabSelect,
} from '../../utils/welcomeEvents';

export type TourStage = 'home' | 'selection' | 'workspace';

export interface TourStageChangeDetail {
  active: boolean;
  stage: TourStage;
  openSettings?: boolean;
}

export const START_USER_TOUR_EVENT = 'markdown-explorer-start-tour';
export const TOUR_STAGE_CHANGE_EVENT = 'markdown-explorer-tour-stage-change';
export const DISMISS_WORKSPACE_TOUR_EVENT = 'markdown-explorer-dismiss-workspace-tour';

export function requestStartUserTour(): void {
  window.dispatchEvent(new CustomEvent(START_USER_TOUR_EVENT));
}

export function requestTourStageChange(detail: TourStageChangeDetail): void {
  window.dispatchEvent(new CustomEvent<TourStageChangeDetail>(TOUR_STAGE_CHANGE_EVENT, { detail }));
}

export function requestDismissWorkspaceTour(): void {
  window.dispatchEvent(new CustomEvent(DISMISS_WORKSPACE_TOUR_EVENT));
}
