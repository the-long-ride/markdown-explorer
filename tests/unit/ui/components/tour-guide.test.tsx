import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TourGuideOverlay } from '../../../../ui/src/components/Tour/TourGuideOverlay';
import {
  START_USER_TOUR_EVENT,
  WELCOME_SELECT_TAB_EVENT,
  TOUR_STAGE_CHANGE_EVENT,
  getLastRequestedWelcomeTab,
  requestStartUserTour,
  requestWelcomeTabSelect,
  requestTourStageChange,
  requestDismissWorkspaceTour,
} from '../../../../ui/src/components/Tour/tourEvents';
import { buildTourSteps } from '../../../../ui/src/components/Tour/tourSteps';
import { getTourTranslations } from '../../../../ui/src/components/Tour/tourTranslations';
import { USER_TOUR_COMPLETE_STORAGE_KEY } from '../../../../ui/src/constants/storage';
import {
  createTourDemoWorkspaceActions,
  createTourClearDemoWorkspaceAction,
  createTourDemoRenderAction,
  isTourDemoPath,
  TOUR_DEMO_WORKSPACE_PATH,
  TOUR_DEMO_WORKSPACE_NAME,
} from '../../../../ui/src/components/Tour/tourDemoWorkspace';

describe('Tour Subsystem', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tourEvents', () => {
    it('dispatches START_USER_TOUR_EVENT when requestStartUserTour is called', () => {
      const listener = vi.fn();
      window.addEventListener(START_USER_TOUR_EVENT, listener);
      requestStartUserTour();
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener(START_USER_TOUR_EVENT, listener);
    });

    it('dispatches WELCOME_SELECT_TAB_EVENT with detail when requestWelcomeTabSelect is called', () => {
      const listener = vi.fn();
      window.addEventListener(WELCOME_SELECT_TAB_EVENT, (e: any) => listener(e.detail));
      requestWelcomeTabSelect('shortcuts');
      expect(listener).toHaveBeenCalledWith('shortcuts');
      expect(getLastRequestedWelcomeTab()).toBe('shortcuts');
    });

    it('dispatches TOUR_STAGE_CHANGE_EVENT with detail when requestTourStageChange is called', () => {
      const listener = vi.fn();
      window.addEventListener(TOUR_STAGE_CHANGE_EVENT, (e: any) => listener(e.detail));
      requestTourStageChange({ active: true, stage: 'workspace', openSettings: true });
      expect(listener).toHaveBeenCalledWith({ active: true, stage: 'workspace', openSettings: true });
    });
  });

  describe('tourTranslations', () => {
    const locales = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'] as const;
    const allStepKeys = [
      'welcome',
      'launchpad',
      'manual',
      'navigation',
      'sidebar',
      'reader',
      'toc',
      'insights',
      'settings',
      'features',
      'shortcuts',
    ] as const;

    it.each(locales)('provides full translations for locale "%s"', (locale) => {
      const trans = getTourTranslations(locale);
      expect(trans.startTour).toBeTruthy();
      expect(trans.startTourHint).toBeTruthy();
      expect(trans.next).toBeTruthy();
      expect(trans.back).toBeTruthy();
      expect(trans.skip).toBeTruthy();
      expect(trans.finish).toBeTruthy();
      expect(trans.stepOf).toContain('{current}');
      expect(trans.stepOf).toContain('{total}');

      for (const key of allStepKeys) {
        const step = trans.steps[key];
        expect(step, `Missing step ${key} in ${locale}`).toBeDefined();
        expect(step.title.trim().length, `Empty title for ${key} in ${locale}`).toBeGreaterThan(0);
        expect(step.desc.trim().length, `Empty desc for ${key} in ${locale}`).toBeGreaterThan(0);
        expect(step.badge.trim().length, `Empty badge for ${key} in ${locale}`).toBeGreaterThan(0);
      }
    });

    it('defaults to English when given an unknown locale', () => {
      const trans = getTourTranslations('xx-unknown' as any);
      const en = getTourTranslations('en');
      expect(trans.startTour).toBe(en.startTour);
    });
  });

  describe('tourSteps', () => {
    it('builds 9 ordered tour steps with home and workspace stages', () => {
      const steps = buildTourSteps('en', 'desktop');
      expect(steps).toHaveLength(9);
      expect(steps.map((s) => s.id)).toEqual([
        'welcome',
        'launchpad',
        'manual',
        'navigation',
        'sidebar',
        'reader',
        'toc',
        'insights',
        'settings',
      ]);
      expect(steps.slice(0, 3).every((s) => s.stage === 'home')).toBe(true);
      expect(steps.slice(3, 9).every((s) => s.stage === 'workspace')).toBe(true);
      expect(steps[0].stage).toBe('home');
      expect(steps[0].welcomeTab).toBe('features');
      expect(steps[1].stage).toBe('home');
      expect(steps[2].stage).toBe('home');
      expect(steps[2].welcomeTab).toBe('manual');
      expect(steps[3].stage).toBe('workspace');
      expect(steps[4].stage).toBe('workspace');
      expect(steps[4].sidebarTab).toBe('files');
      expect(steps[5].stage).toBe('workspace');
      expect(steps[6].stage).toBe('workspace');
      expect(steps[6].ensureTocOpen).toBe(true);
      expect(steps[7].stage).toBe('workspace');
      expect(steps[8].stage).toBe('workspace');
      expect(steps[8].openSettings).toBe(true);
    });
  });

  describe('tourDemoWorkspace', () => {
    const defaultOptions = {
      theme: 'dark' as const,
      themeStyle: 'default' as const,
      appRuntime: 'desktop' as const,
      hostPlatform: 'windows' as const,
    };

    it('creates READY_ACK and RENDER_CONTENT demo workspace actions with demo files, tree, tabs, and toc', () => {
      const actions = createTourDemoWorkspaceActions(defaultOptions);
      expect(actions).toHaveLength(2);

      const [readyAction, renderAction] = actions;
      expect(readyAction.type).toBe('READY_ACK');
      if (readyAction.type === 'READY_ACK') {
        expect(readyAction.workspaceName).toBe(TOUR_DEMO_WORKSPACE_NAME);
        expect(readyAction.workspacePath).toBe(TOUR_DEMO_WORKSPACE_PATH);
        expect(readyAction.theme).toBe('dark');
        expect(readyAction.themeStyle).toBe('default');
        expect(readyAction.appRuntime).toBe('desktop');
        expect(readyAction.hostPlatform).toBe('windows');
        expect(readyAction.fileList).toHaveLength(1);
        expect(readyAction.fileList[0].fileName).toBe('Welcome.md');
        expect(readyAction.fileList[0].title).toBe('Welcome to your Virtual Workspace');
        expect(readyAction.tree).toBeTruthy();
        expect(readyAction.tree?.name).toBe(TOUR_DEMO_WORKSPACE_NAME);
        expect(readyAction.tree?.children).toEqual([]);
        expect(readyAction.tree?.files).toEqual(readyAction.fileList);
        expect(readyAction.contentTabs).toHaveLength(1);
        expect(readyAction.activeContentTabPath).toBe(readyAction.fileList[0].fsPath);

        const firstTab = readyAction.contentTabs[0];
        expect(firstTab.filePath).toBe(readyAction.fileList[0].fsPath);
        expect(firstTab.contentHtml).toContain('Welcome to your Virtual Workspace');
        expect(firstTab.toc.length).toBeGreaterThan(0);
        expect(firstTab.documentWrite).toEqual({
          supported: true,
          revision: expect.any(String),
        });
      }

      expect(renderAction.type).toBe('RENDER_CONTENT');
      if (renderAction.type === 'RENDER_CONTENT') {
        expect(renderAction.msg.command).toBe('renderContent');
        expect(renderAction.msg.filePath).toContain('Welcome.md');
        expect(renderAction.msg.html).toContain('Welcome to your Virtual Workspace');
        expect(renderAction.msg.toc.length).toBeGreaterThan(0);
        expect(renderAction.msg.fileList).toHaveLength(1);
        expect(renderAction.msg.documentWrite).toEqual({
          supported: true,
          revision: expect.any(String),
        });
      }
    });

    it('creates READY_ACK action that clears the demo workspace', () => {
      const clearAction = createTourClearDemoWorkspaceAction(defaultOptions);
      expect(clearAction.type).toBe('READY_ACK');
      expect(clearAction.fileList).toEqual([]);
      expect(clearAction.tree).toBeNull();
      expect(clearAction.workspaceName).toBe('');
      expect(clearAction.workspacePath).toBeUndefined();
      expect(clearAction.contentTabs).toEqual([]);
      expect(clearAction.activeContentTabPath).toBeNull();
      expect(clearAction.theme).toBe('dark');
      expect(clearAction.themeStyle).toBe('default');
      expect(clearAction.appRuntime).toBe('desktop');
      expect(clearAction.hostPlatform).toBe('windows');
    });

    it('identifies tour demo paths with isTourDemoPath', () => {
      expect(isTourDemoPath(TOUR_DEMO_WORKSPACE_PATH)).toBe(true);
      expect(isTourDemoPath(`${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md`)).toBe(true);
      expect(isTourDemoPath(`${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md#heading`)).toBe(true);
      expect(isTourDemoPath(null)).toBe(false);
      expect(isTourDemoPath(undefined)).toBe(false);
      expect(isTourDemoPath('/regular/project/path.md')).toBe(false);
    });

    it('creates RENDER_CONTENT action for the demo file without loading state', () => {
      const demoPath = `${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md`;
      const action = createTourDemoRenderAction(demoPath);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('RENDER_CONTENT');
      if (action?.type === 'RENDER_CONTENT') {
        expect(action.msg.command).toBe('renderContent');
        expect(action.msg.title).toBe('Welcome to your Virtual Workspace');
        expect(action.msg.filePath).toBe(demoPath);
        expect(action.msg.isLoading).not.toBe(true);
        expect(action.msg.html).toContain('Welcome to your Virtual Workspace');
        expect(action.msg.markdownSource).toContain('Welcome to your Virtual Workspace');
        expect(action.msg.toc).toEqual([
          { id: 'welcome-to-your-virtual-workspace', text: 'Welcome to your Virtual Workspace', level: 1 },
        ]);
        expect(action.msg.documentWrite).toEqual({
          supported: true,
          revision: expect.any(String),
        });
      }
    });

    it('createTourDemoRenderAction falls back to first demo file for root demo path and strips hashes', () => {
      const actionWithHash = createTourDemoRenderAction(`${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md#welcome-to-your-virtual-workspace`);
      expect(actionWithHash?.type).toBe('RENDER_CONTENT');
      if (actionWithHash?.type === 'RENDER_CONTENT') {
        expect(actionWithHash.msg.title).toBe('Welcome to your Virtual Workspace');
      }

      const fallbackAction = createTourDemoRenderAction(TOUR_DEMO_WORKSPACE_PATH);
      expect(fallbackAction?.type).toBe('RENDER_CONTENT');
      if (fallbackAction?.type === 'RENDER_CONTENT') {
        expect(fallbackAction.msg.title).toBe('Welcome to your Virtual Workspace');
      }

      const nonDemoAction = createTourDemoRenderAction('/outside/workspace/doc.md');
      expect(nonDemoAction).toBeNull();
    });
  });

  describe('TourGuideOverlay Component', () => {
    it('renders null initially when tour has not started', () => {
      const { container } = render(<TourGuideOverlay />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();
    });

    it('opens on START_USER_TOUR_EVENT and displays first step', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const overlay = screen.getByTestId('tour-guide-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.getAttribute('data-tour-step')).toBe('welcome');
      expect(screen.getByText('Step 1 of 9')).toBeTruthy();
      expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
    });

    it('navigates through steps with Next and Back buttons', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const backBtn = screen.getByRole('button', { name: /^back$/i });
      const nextBtn = screen.getByRole('button', { name: /^next$/i });

      expect(backBtn).toBeDisabled();

      // Click next -> Step 2
      fireEvent.click(nextBtn);
      const overlay = screen.getByTestId('tour-guide-overlay');
      expect(overlay.getAttribute('data-tour-step')).toBe('launchpad');
      expect(screen.getByText('Step 2 of 9')).toBeTruthy();
      expect(backBtn).not.toBeDisabled();

      // Click back -> Step 1
      fireEvent.click(backBtn);
      expect(overlay.getAttribute('data-tour-step')).toBe('welcome');
      expect(backBtn).toBeDisabled();
    });

    it('changes Next button to Finish on the last step and completes tour on click', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      // Navigate to step 9 (index 8)
      for (let i = 0; i < 8; i++) {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      }

      expect(screen.getByText('Step 9 of 9')).toBeTruthy();
      const finishBtn = screen.getByRole('button', { name: /finish|complete/i });
      expect(finishBtn).toBeTruthy();

      fireEvent.click(finishBtn);
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();
      expect(localStorage.getItem(USER_TOUR_COMPLETE_STORAGE_KEY)).toBe('true');
    });

    it('closes and stores completion key when Skip is clicked', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const skipBtn = screen.getByRole('button', { name: /skip/i });
      fireEvent.click(skipBtn);

      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();
      expect(localStorage.getItem(USER_TOUR_COMPLETE_STORAGE_KEY)).toBe('true');
    });

    it('supports keyboard navigation: ArrowRight, ArrowLeft, and Escape', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      expect(screen.getByText('Step 1 of 9')).toBeTruthy();

      // ArrowRight -> Step 2
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByText('Step 2 of 9')).toBeTruthy();

      // ArrowLeft -> Step 1
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByText('Step 1 of 9')).toBeTruthy();

      // Escape -> Closes tour
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();
      expect(localStorage.getItem(USER_TOUR_COMPLETE_STORAGE_KEY)).toBe('true');
    });

    it('provides aria-keyshortcuts and shortcut tooltips for Skip (Esc), Back (ArrowLeft / ←), and Next/Finish (ArrowRight / →)', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const skipBtn = screen.getByRole('button', { name: /^skip$/i });
      const backBtn = screen.getByRole('button', { name: /^back$/i });
      const nextBtn = screen.getByRole('button', { name: /^next$/i });

      expect(skipBtn).toHaveAttribute('aria-keyshortcuts', 'Escape');
      expect(backBtn).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft');
      expect(nextBtn).toHaveAttribute('aria-keyshortcuts', 'ArrowRight');

      // Hover Skip -> portal tooltip displays Esc
      fireEvent.mouseEnter(skipBtn);
      const portalTooltipSkip = document.querySelector('.tooltip-portal');
      expect(portalTooltipSkip).toBeTruthy();
      expect(portalTooltipSkip?.textContent).toContain('Esc');
      fireEvent.mouseLeave(skipBtn);

      // Hover Next -> portal tooltip displays →
      fireEvent.mouseEnter(nextBtn);
      let portalTooltip = document.querySelector('.tooltip-portal');
      expect(portalTooltip).toBeTruthy();
      expect(portalTooltip?.textContent).toContain('→');
      fireEvent.mouseLeave(nextBtn);

      // Advance to step 2 so Back button is enabled
      fireEvent.click(nextBtn);

      // Hover Back -> portal tooltip displays ←
      fireEvent.mouseEnter(backBtn);
      portalTooltip = document.querySelector('.tooltip-portal');
      expect(portalTooltip).toBeTruthy();
      expect(portalTooltip?.textContent).toContain('←');
      fireEvent.mouseLeave(backBtn);
    });

    it('ignores ArrowLeft and ArrowRight when typing inside input elements', () => {
      render(
        <div>
          <input data-testid="test-input" type="text" />
          <TourGuideOverlay />
        </div>
      );
      act(() => {
        requestStartUserTour();
      });

      expect(screen.getByText('Step 1 of 9')).toBeTruthy();

      const input = screen.getByTestId('test-input');
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      // Remains on step 1 because arrow keys in input are not hijacked
      expect(screen.getByText('Step 1 of 9')).toBeTruthy();
    });

    it('registers keydown listener in capture phase so bubbles cannot intercept', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const keydownCalls = addEventListenerSpy.mock.calls.filter(call => call[0] === 'keydown');
      expect(keydownCalls.some(call => call[2] === true)).toBe(true);
    });

    it('navigates via step dot buttons', () => {
      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const overlay = screen.getByTestId('tour-guide-overlay');
      const dots = overlay.querySelectorAll<HTMLButtonElement>('.tour-guide-dot');
      expect(dots).toHaveLength(9);

      // Jump to step 3
      fireEvent.click(dots[2]);
      expect(screen.getByText('Step 3 of 9')).toBeTruthy();
    });

    it('dispatches requestWelcomeTabSelect when stepping to a step with welcomeTab', () => {
      const tabListener = vi.fn();
      window.addEventListener(WELCOME_SELECT_TAB_EVENT, (e: any) => tabListener(e.detail));

      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      // Step 1 has welcomeTab: 'features'
      expect(tabListener).toHaveBeenCalledWith('features');

      // Step 2 has no welcomeTab
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Step 3 has welcomeTab: 'manual'
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(tabListener).toHaveBeenLastCalledWith('manual');
    });

    it('dispatches requestWelcomeTabSelect synchronously and again via timeout for lazy welcome components', () => {
      vi.useFakeTimers();
      const tabListener = vi.fn();
      window.addEventListener(WELCOME_SELECT_TAB_EVENT, (e: any) => tabListener(e.detail));

      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      expect(tabListener).toHaveBeenCalledWith('features');
      const initialCount = tabListener.mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(60);
      });

      expect(tabListener.mock.calls.length).toBeGreaterThan(initialCount);
      expect(tabListener).toHaveBeenLastCalledWith('features');
      vi.useRealTimers();
    });

    it('dispatches requestTourStageChange when transitioning steps and closing', () => {
      const stageListener = vi.fn();
      window.addEventListener(TOUR_STAGE_CHANGE_EVENT, (e: any) => stageListener(e.detail));

      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      // Step 1 (home)
      expect(stageListener).toHaveBeenCalledWith({
        active: true,
        stage: 'home',
        openSettings: false,
      });

      // Jump to Step 4 (navigation -> workspace)
      const overlay = screen.getByTestId('tour-guide-overlay');
      const dots = overlay.querySelectorAll<HTMLButtonElement>('.tour-guide-dot');
      fireEvent.click(dots[3]);

      expect(stageListener).toHaveBeenLastCalledWith({
        active: true,
        stage: 'workspace',
        openSettings: false,
      });

      // Jump to Step 9 (settings -> workspace with openSettings: true)
      fireEvent.click(dots[8]);
      expect(stageListener).toHaveBeenLastCalledWith({
        active: true,
        stage: 'workspace',
        openSettings: true,
      });

      // Close tour
      const skipBtn = screen.getByRole('button', { name: /skip/i });
      fireEvent.click(skipBtn);
      expect(stageListener).toHaveBeenLastCalledWith({
        active: false,
        stage: 'home',
        openSettings: false,
      });
    });

    it('dispatches requestTourStageChange when navigating sequentially and completing via finish button', () => {
      const stageListener = vi.fn();
      window.addEventListener(TOUR_STAGE_CHANGE_EVENT, (e: any) => stageListener(e.detail));

      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      expect(stageListener).toHaveBeenCalledWith({
        active: true,
        stage: 'home',
        openSettings: false,
      });

      const nextBtn = screen.getByRole('button', { name: /^next$/i });

      // Step 2
      fireEvent.click(nextBtn);
      // Step 3
      fireEvent.click(nextBtn);
      // Step 4 (navigation -> workspace)
      fireEvent.click(nextBtn);
      expect(stageListener).toHaveBeenLastCalledWith({
        active: true,
        stage: 'workspace',
        openSettings: false,
      });

      // Steps 5 to 8
      for (let i = 0; i < 4; i++) {
        fireEvent.click(nextBtn);
      }

      // Step 9 (settings -> workspace with openSettings: true)
      fireEvent.click(nextBtn);
      expect(stageListener).toHaveBeenLastCalledWith({
        active: true,
        stage: 'workspace',
        openSettings: true,
      });

      const finishBtn = screen.getByRole('button', { name: /finish|complete/i });
      fireEvent.click(finishBtn);
      expect(stageListener).toHaveBeenLastCalledWith({
        active: false,
        stage: 'home',
        openSettings: false,
      });
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();
    });

    it('detects target elements in DOM and sets data-has-target="true"', () => {
      const hero = document.createElement('div');
      hero.setAttribute('data-tour-id', 'welcome-hero');
      document.body.appendChild(hero);

      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      const overlay = screen.getByTestId('tour-guide-overlay');
      expect(overlay.getAttribute('data-has-target')).toBe('true');
    });

    it('does not open when isBlocked is true and defers until unblocked', () => {
      const { rerender } = render(<TourGuideOverlay isBlocked={true} />);
      act(() => {
        requestStartUserTour();
      });
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();

      rerender(<TourGuideOverlay isBlocked={false} />);
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();
    });

    it('does not open when updatePromptOpen is true and defers until update modal closes', () => {
      const { rerender } = render(<TourGuideOverlay updatePromptOpen={true} />);
      act(() => {
        requestStartUserTour();
      });
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();

      rerender(<TourGuideOverlay updatePromptOpen={false} />);
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();
    });

    it('yields and hides at step 0 if updatePromptOpen becomes true before interaction, then resumes when dismissed', () => {
      const { rerender } = render(<TourGuideOverlay updatePromptOpen={false} />);
      act(() => {
        requestStartUserTour();
      });
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();

      // New update modal pops up while tour is at step 0
      rerender(<TourGuideOverlay updatePromptOpen={true} />);
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();

      // User dismisses new update modal
      rerender(<TourGuideOverlay updatePromptOpen={false} />);
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();
    });

    it('yields and hides at step 0 if isBlocked becomes true (e.g. support prompt opens) before interaction, then resumes when unblocked', () => {
      const { rerender } = render(<TourGuideOverlay isBlocked={false} />);
      act(() => {
        requestStartUserTour();
      });
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();

      // Blocking modal (e.g. support prompt) pops up while tour is at step 0
      rerender(<TourGuideOverlay isBlocked={true} />);
      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();

      // Modal dismissed
      rerender(<TourGuideOverlay isBlocked={false} />);
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();
    });

    it('calls onOpenChange callback when opening, closing, or yielding', () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(<TourGuideOverlay onOpenChange={onOpenChange} isBlocked={false} />);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);

      act(() => {
        requestStartUserTour();
      });
      expect(onOpenChange).toHaveBeenLastCalledWith(true);

      // Yields when blocked
      rerender(<TourGuideOverlay onOpenChange={onOpenChange} isBlocked={true} />);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);

      // Resumes when unblocked
      rerender(<TourGuideOverlay onOpenChange={onOpenChange} isBlocked={false} />);
      expect(onOpenChange).toHaveBeenLastCalledWith(true);

      // User skips/finishes
      const skipBtn = screen.getByRole('button', { name: /skip/i });
      fireEvent.click(skipBtn);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('does not yield at step > 0 once user has interacted with the tour', () => {
      const { rerender } = render(<TourGuideOverlay isBlocked={false} />);
      act(() => {
        requestStartUserTour();
      });
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();

      // User interacts: clicks Next to go to Step 2
      const nextBtn = screen.getByRole('button', { name: /^next$/i });
      fireEvent.click(nextBtn);
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();

      // A blocking flag arrives while tour is active and in-progress
      rerender(<TourGuideOverlay isBlocked={true} />);
      // Should remain open at Step 2
      expect(screen.getByTestId('tour-guide-overlay')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    });

    it('dismisses the workspace tour when requestDismissWorkspaceTour is fired during workspace stage', () => {
      const stageListener = vi.fn();
      window.addEventListener(TOUR_STAGE_CHANGE_EVENT, (e: any) => stageListener(e.detail));

      render(<TourGuideOverlay />);
      act(() => {
        requestStartUserTour();
      });

      // Advance to step 4 (stage: 'workspace')
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
      }
      expect(stageListener).toHaveBeenLastCalledWith({ active: true, stage: 'workspace', openSettings: false });

      act(() => {
        requestDismissWorkspaceTour();
      });

      expect(screen.queryByTestId('tour-guide-overlay')).toBeNull();
      expect(stageListener).toHaveBeenLastCalledWith({ active: false, stage: 'home', openSettings: false });
      expect(localStorage.getItem(USER_TOUR_COMPLETE_STORAGE_KEY)).toBe('true');
    });
  });
});
