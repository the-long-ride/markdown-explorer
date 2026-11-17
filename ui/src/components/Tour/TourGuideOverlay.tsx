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
import { USER_TOUR_COMPLETE_STORAGE_KEY } from '../../constants/storage';

function useSafeAppState() {
  try {
    return useAppState();
  } catch {
    return null;
  }
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
  const [coords, setCoords] = useState({
    spotTop: 0,
    spotLeft: 0,
    spotWidth: 0,
    spotHeight: 0,
    cardTop: 0,
    cardLeft: 0,
  });

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const injectedDemoRef = useRef(false);
  const pendingTourRef = useRef(false);
  const userInteractedRef = useRef(false);

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

    let foundEl: HTMLElement | null = null;
    const candidates = document.querySelectorAll<HTMLElement>(activeStep.targetSelector);
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        foundEl = el;
        break;
      }
    }
    if (!foundEl && candidates.length > 0) {
      foundEl = candidates[0];
    }

    if (foundEl) {
      foundEl.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      const rect = foundEl.getBoundingClientRect();
      const pad = 8;
      const spotTop = Math.max(0, rect.top - pad);
      const spotLeft = Math.max(0, rect.left - pad);
      const spotWidth = Math.max(0, rect.width + pad * 2);
      const spotHeight = Math.max(0, rect.height + pad * 2);

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
      const cardWidth = 360;
      const cardHeight = 220;

      let cardTop = spotTop + spotHeight + 12;
      if (cardTop + cardHeight > vh - 20) {
        cardTop = Math.max(20, spotTop - cardHeight - 12);
      }
      let cardLeft = spotLeft + spotWidth / 2 - cardWidth / 2;
      cardLeft = Math.max(20, Math.min(vw - cardWidth - 20, cardLeft));

      setHasTarget(true);
      setCoords({
        spotTop,
        spotLeft,
        spotWidth,
        spotHeight,
        cardTop,
        cardLeft,
      });
    } else {
      setHasTarget(false);
    }
  }, [isOpen, activeStep]);

  useEffect(() => {
    if (!isOpen || !activeStep) return;

    if (activeStep.stage === 'workspace') {
      if (
        appStateCtx?.dispatch &&
        (!appStateCtx.state?.workspaceName || appStateCtx.state?.workspacePath === TOUR_DEMO_WORKSPACE_PATH)
      ) {
        if (!injectedDemoRef.current) {
          const actions = createTourDemoWorkspaceActions({
            theme: appStateCtx.state?.theme ?? 'dark',
            themeStyle: appStateCtx.state?.themeStyle ?? 'default',
            appRuntime: appStateCtx.state?.appRuntime ?? 'desktop',
            hostPlatform: appStateCtx.state?.hostPlatform ?? 'windows',
          });
          for (const action of actions) {
            appStateCtx.dispatch(action);
          }
          injectedDemoRef.current = true;
        }
      }
      if (appStateCtx?.setSidebarCollapsed) {
        appStateCtx.setSidebarCollapsed(false);
      }
      if (activeStep.sidebarTab && appStateCtx?.setSidebarActiveTab) {
        appStateCtx.setSidebarActiveTab(activeStep.sidebarTab);
      }
      if (activeStep.ensureTocOpen && appStateCtx?.state?.tocCollapsed) {
        appStateCtx.toggleToc?.();
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
  }, [isOpen, activeStep, appStateCtx, updateTarget]);

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
    if (
      (injectedDemoRef.current || appStateCtx?.state?.workspacePath === TOUR_DEMO_WORKSPACE_PATH) &&
      appStateCtx?.dispatch
    ) {
      const clearAction = createTourClearDemoWorkspaceAction({
        theme: appStateCtx.state?.theme ?? 'dark',
        themeStyle: appStateCtx.state?.themeStyle ?? 'default',
        appRuntime: appStateCtx.state?.appRuntime ?? 'desktop',
        hostPlatform: appStateCtx.state?.hostPlatform ?? 'windows',
      });
      appStateCtx.dispatch(clearAction);
      injectedDemoRef.current = false;
    }
    try {
      localStorage.setItem(USER_TOUR_COMPLETE_STORAGE_KEY, 'true');
    } catch {}
    setIsOpen(false);
  }, [appStateCtx]);

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
