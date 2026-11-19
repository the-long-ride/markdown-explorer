import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { useCssVars } from '../../utils/useCssVars';
import { TooltipButton } from '../shared/TooltipButton';
import {
  DISMISS_WORKSPACE_TOUR_EVENT,
  START_USER_TOUR_EVENT,
  requestWelcomeTabSelect,
  requestTourStageChange,
} from './tourEvents';
import { buildTourSteps } from './tourSteps';
import { getTourTranslations } from './tourTranslations';
import {
  createTourDemoWorkspaceActions,
  createTourClearDemoWorkspaceAction,
  TOUR_DEMO_WORKSPACE_PATH,
} from './tourDemoWorkspace';
import {
  INITIAL_TOUR_COORDS,
  areTourCoordsEqual,
  computeTourTargetCoords,
} from './tourTargetPosition';
import { USER_TOUR_COMPLETE_STORAGE_KEY } from '../../constants/storage';

function useSafeAppState() {
  try {
    return useAppState();
  } catch {
    return null;
  }
}

function getDemoWorkspaceOptions(ctx: ReturnType<typeof useSafeAppState>) {
  return {
    theme: ctx?.state?.theme ?? 'dark',
    themeStyle: ctx?.state?.themeStyle ?? 'default',
    appRuntime: ctx?.state?.appRuntime ?? 'desktop',
    hostPlatform: ctx?.state?.hostPlatform ?? 'windows',
  };
}

export interface TourGuideOverlayProps {
  readonly isBlocked?: boolean;
  readonly updatePromptOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function TourGuideOverlay({
  isBlocked = false,
  updatePromptOpen = false,
  onOpenChange,
}: TourGuideOverlayProps = {}) {
  const appStateCtx = useSafeAppState();
  const language = appStateCtx?.state?.settings?.language || 'en';
  const runtime = appStateCtx?.state?.appRuntime || 'desktop';

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasTarget, setHasTarget] = useState(false);
  const [coords, setCoords] = useState(INITIAL_TOUR_COORDS);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const injectedDemoRef = useRef(false);
  const pendingTourRef = useRef(false);
  const userInteractedRef = useRef(false);
  const appStateCtxRef = useRef(appStateCtx);
  appStateCtxRef.current = appStateCtx;

  const steps = useMemo(() => buildTourSteps(language, runtime), [language, runtime]);
  const tt = useMemo(() => getTourTranslations(language), [language]);
  const activeStep = steps[stepIndex] ?? steps[0];

  useCssVars(
    overlayRef,
    useMemo(
      () => ({
        '--tour-spot-top': `${coords.spotTop}px`,
        '--tour-spot-left': `${coords.spotLeft}px`,
        '--tour-spot-width': `${coords.spotWidth}px`,
        '--tour-spot-height': `${coords.spotHeight}px`,
        '--tour-card-top': `${coords.cardTop}px`,
        '--tour-card-left': `${coords.cardLeft}px`,
      }),
      [coords],
    ),
  );

  useEffect(() => {
    const handleStart = () => {
      if (isBlocked || updatePromptOpen) {
        pendingTourRef.current = true;
        return;
      }
      injectedDemoRef.current = false;
      userInteractedRef.current = false;
      setStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener(START_USER_TOUR_EVENT, handleStart);
    return () => window.removeEventListener(START_USER_TOUR_EVENT, handleStart);
  }, [isBlocked, updatePromptOpen]);

  useEffect(() => {
    if (!isBlocked && !updatePromptOpen && pendingTourRef.current && !isOpen) {
      pendingTourRef.current = false;
      injectedDemoRef.current = false;
      userInteractedRef.current = false;
      setStepIndex(0);
      setIsOpen(true);
    }
  }, [isBlocked, updatePromptOpen, isOpen]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen && (isBlocked || updatePromptOpen) && !userInteractedRef.current && stepIndex === 0) {
      setIsOpen(false);
      pendingTourRef.current = true;
    }
  }, [isOpen, isBlocked, updatePromptOpen, stepIndex]);

  const updateTarget = useCallback(() => {
    if (!isOpen || !activeStep) return;
    const nextCoords = computeTourTargetCoords(activeStep.targetSelector);
    if (nextCoords) {
      setHasTarget(true);
      setCoords((prev) => (areTourCoordsEqual(prev, nextCoords) ? prev : nextCoords));
    } else {
      setHasTarget(false);
    }
  }, [isOpen, activeStep]);

  useEffect(() => {
    if (!isOpen || !activeStep) return;
    const ctx = appStateCtxRef.current;

    if (activeStep.stage === 'workspace') {
      if (
        runtime === 'web' &&
        ctx?.dispatch &&
        (!ctx.state?.workspaceName || ctx.state?.workspacePath === TOUR_DEMO_WORKSPACE_PATH)
      ) {
        if (!injectedDemoRef.current) {
          const actions = createTourDemoWorkspaceActions(getDemoWorkspaceOptions(ctx));
          for (const action of actions) {
            ctx.dispatch(action);
          }
          injectedDemoRef.current = true;
        }
      }
      if (ctx?.setSidebarCollapsed && ctx.state?.sidebarCollapsed !== false) {
        ctx.setSidebarCollapsed(false);
      }
      if (activeStep.sidebarTab && ctx?.setSidebarActiveTab && ctx.state?.sidebarActiveTab !== activeStep.sidebarTab) {
        ctx.setSidebarActiveTab(activeStep.sidebarTab);
      }
      if (activeStep.ensureTocOpen && ctx?.state?.tocCollapsed) {
        ctx.toggleToc?.();
      }
    }

    requestTourStageChange({
      active: true,
      stage: activeStep.stage,
      openSettings: Boolean(activeStep.openSettings),
    });

    let tabTimer: ReturnType<typeof setTimeout> | undefined;
    if (activeStep.welcomeTab) {
      requestWelcomeTabSelect(activeStep.welcomeTab);
      tabTimer = setTimeout(() => {
        requestWelcomeTabSelect(activeStep.welcomeTab!);
        updateTarget();
      }, 60);
    }
    return () => {
      if (tabTimer) clearTimeout(tabTimer);
    };
  }, [isOpen, activeStep, runtime, updateTarget]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;
    void import('../Sidebar/Sidebar').catch(() => {});
    void import('../Content/Content').catch(() => {});
    void import('../Content/ContentTabs').catch(() => {});
    void import('../TOC/TableOfContents').catch(() => {});
    void import('../Settings/SettingsModal').catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    updateTarget();
    const rafId = requestAnimationFrame(updateTarget);
    const t60 = setTimeout(updateTarget, 60);
    const t180 = setTimeout(updateTarget, 180);
    const t350 = setTimeout(updateTarget, 350);
    const handleViewportUpdate = () => updateTarget();
    window.addEventListener('resize', handleViewportUpdate);
    window.addEventListener('scroll', handleViewportUpdate, true);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t60);
      clearTimeout(t180);
      clearTimeout(t350);
      window.removeEventListener('resize', handleViewportUpdate);
      window.removeEventListener('scroll', handleViewportUpdate, true);
    };
  }, [isOpen, updateTarget]);

  const handleClose = useCallback(() => {
    pendingTourRef.current = false;
    userInteractedRef.current = false;
    requestTourStageChange({ active: false, stage: 'home', openSettings: false });
    const ctx = appStateCtxRef.current;
    if (
      (injectedDemoRef.current || ctx?.state?.workspacePath === TOUR_DEMO_WORKSPACE_PATH) &&
      ctx?.dispatch
    ) {
      const clearAction = createTourClearDemoWorkspaceAction(getDemoWorkspaceOptions(ctx));
      ctx.dispatch(clearAction);
      injectedDemoRef.current = false;
    }
    try {
      localStorage.setItem(USER_TOUR_COMPLETE_STORAGE_KEY, 'true');
    } catch {}
    setIsOpen(false);
  }, []);

  const handleSkip = useCallback(() => {
    handleClose();
  }, [handleClose]);

  useEffect(() => {
    const handleDismissWorkspaceTour = () => {
      if (!isOpen || activeStep?.stage !== 'workspace') return;
      pendingTourRef.current = false;
      userInteractedRef.current = false;
      injectedDemoRef.current = false;
      requestTourStageChange({ active: false, stage: 'home', openSettings: false });
      try {
        localStorage.setItem(USER_TOUR_COMPLETE_STORAGE_KEY, 'true');
      } catch {}
      setIsOpen(false);
    };
    window.addEventListener(DISMISS_WORKSPACE_TOUR_EVENT, handleDismissWorkspaceTour);
    return () => window.removeEventListener(DISMISS_WORKSPACE_TOUR_EVENT, handleDismissWorkspaceTour);
  }, [activeStep?.stage, isOpen]);

  const handleNext = useCallback(() => {
    userInteractedRef.current = true;
    if (stepIndex >= steps.length - 1) {
      handleClose();
    } else {
      setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }
  }, [stepIndex, steps.length, handleClose]);

  const handleBack = useCallback(() => {
    userInteractedRef.current = true;
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      const isInput =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        handleClose();
      } else if (e.key === 'ArrowRight') {
        if (isInput) return;
        e.preventDefault();
        e.stopPropagation();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        if (isInput) return;
        e.preventDefault();
        e.stopPropagation();
        if (stepIndex > 0) handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleClose, handleNext, handleBack, stepIndex]);

  if (!isOpen) return null;

  const isLastStep = stepIndex === steps.length - 1;
  const progressText = tt.stepOf
    .replace('{current}', String(stepIndex + 1))
    .replace('{total}', String(steps.length));

  return (
    <div
      ref={overlayRef}
      className="tour-guide-overlay"
      data-testid="tour-guide-overlay"
      data-has-target={hasTarget ? 'true' : 'false'}
      data-tour-step={activeStep.id}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-guide-title"
    >
      <div className="tour-guide-backdrop" onClick={handleSkip} />
      <div className="tour-guide-spotlight" aria-hidden="true" />
      <div className="tour-guide-card">
        <div className="tour-guide-card-header">
          <div className="tour-guide-header-meta">
            <span className="tour-guide-badge">{activeStep.badge}</span>
            <span className="tour-guide-progress-text">{progressText}</span>
          </div>
          <TooltipButton
            type="button"
            className="tour-guide-skip-btn"
            onClick={handleSkip}
            label={tt.skip}
            tooltip={tt.skip}
            shortcut="Esc"
            tooltipPos="above"
            onlyIcon={false}
            portalTooltip={true}
            aria-keyshortcuts="Escape"
          />
        </div>

        <h3 id="tour-guide-title" className="tour-guide-title">
          {activeStep.title}
        </h3>
        <p className="tour-guide-desc">{activeStep.desc}</p>

        <div className="tour-guide-card-footer">
          <div className="tour-guide-dots" role="tablist" aria-label="Tour steps">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`tour-guide-dot ${idx === stepIndex ? 'tour-guide-dot--active' : ''}`}
                onClick={() => {
                  userInteractedRef.current = true;
                  setStepIndex(idx);
                }}
                aria-label={s.title}
                aria-current={idx === stepIndex ? 'step' : undefined}
              />
            ))}
          </div>
          <div className="tour-guide-actions">
            <TooltipButton
              type="button"
              className="tour-guide-btn tour-guide-btn--secondary"
              disabled={stepIndex === 0}
              onClick={handleBack}
              label={tt.back}
              tooltip={tt.back}
              shortcut="ArrowLeft"
              tooltipPos="above"
              onlyIcon={false}
              portalTooltip={true}
              aria-keyshortcuts="ArrowLeft"
            />
            <TooltipButton
              type="button"
              className="tour-guide-btn tour-guide-btn--primary"
              onClick={handleNext}
              label={isLastStep ? tt.finish : tt.next}
              tooltip={isLastStep ? tt.finish : tt.next}
              shortcut="ArrowRight"
              tooltipPos="above"
              onlyIcon={false}
              portalTooltip={true}
              aria-keyshortcuts="ArrowRight"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
