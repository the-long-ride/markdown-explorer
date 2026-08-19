import { useEffect, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { SCOPE_NAVIGATION_STATE_EVENT, type ScopeNavigationStateDetail } from '../Modal/scopeHistory';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CollapseIcon,
  CopyIcon,
  ExpandIcon,
  RefreshIcon,
} from './icons';
import { TooltipButton } from './TooltipButton';

interface NavigationHeaderActionsProps {
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  className?: string;
}

export function NavigationHeaderActions({
  onBack,
  onForward,
  onRefresh,
  canGoBack,
  canGoForward,
  className = '',
}: NavigationHeaderActionsProps) {
  const { state } = useAppState();
  const t = getTranslations(state.settings.language || 'en');
  const [scopeActive, setScopeActive] = useState(
    () => typeof document !== 'undefined' && Boolean(document.querySelector('.scope-view')),
  );

  useEffect(() => {
    const handleScopeState = (event: Event) => {
      const detail = (event as CustomEvent<ScopeNavigationStateDetail>).detail;
      setScopeActive(Boolean(detail?.active));
    };
    window.addEventListener(SCOPE_NAVIGATION_STATE_EVENT, handleScopeState);
    return () => window.removeEventListener(SCOPE_NAVIGATION_STATE_EVENT, handleScopeState);
  }, []);

  return (
    <div className={`header-action-group header-action-group--navigation ${className}`.trim()}>
      <TooltipButton
        className="btn btn--icon"
        onClick={onBack}
        disabled={scopeActive || !canGoBack}
        tooltip={t.topbar.goBack}
        shortcut={getEnabledShortcut(state.settings, 'back')}
        icon={<ChevronLeftIcon />}
      />
      <TooltipButton
        className="btn btn--icon"
        onClick={onForward}
        disabled={scopeActive || !canGoForward}
        tooltip={t.topbar.goForward}
        shortcut={getEnabledShortcut(state.settings, 'forward')}
        icon={<ChevronRightIcon />}
      />
      <TooltipButton
        className="btn btn--icon"
        onClick={onRefresh}
        disabled={!state.currentFile}
        tooltip={t.topbar.refresh}
        shortcut={getEnabledShortcut(state.settings, 'refresh')}
        icon={<RefreshIcon />}
      />
    </div>
  );
}

interface DocumentHeaderActionsProps {
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onCopyFile: (button?: HTMLElement | null) => void;
  canCopyFile: boolean;
  className?: string;
}

export function DocumentHeaderActions({
  onCollapseAll,
  onExpandAll,
  onCopyFile,
  canCopyFile,
  className = '',
}: DocumentHeaderActionsProps) {
  const { state } = useAppState();
  const t = getTranslations(state.settings.language || 'en');

  return (
    <div className={`header-action-group header-action-group--document ${className}`.trim()}>
      <TooltipButton
        className="btn btn--icon"
        onClick={onCollapseAll}
        tooltip={t.topbar.collapseAll}
        shortcut={getEnabledShortcut(state.settings, 'collapseAll')}
        icon={<CollapseIcon />}
      />
      <TooltipButton
        className="btn btn--icon"
        onClick={onExpandAll}
        tooltip={t.topbar.expandAll}
        shortcut={getEnabledShortcut(state.settings, 'expandAll')}
        icon={<ExpandIcon />}
      />
      <TooltipButton
        className="btn btn--icon"
        onClick={(event) => onCopyFile(event.currentTarget)}
        tooltip={t.topbar.copy}
        disabled={!canCopyFile}
        icon={<CopyIcon />}
      />
    </div>
  );
}
