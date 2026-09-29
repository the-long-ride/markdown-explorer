// =============================================================================
// components/Settings/SettingsVersionFooter.tsx — Version link + donate button
// at the bottom of the Settings navigation rail
// =============================================================================

import { DONATE_URL } from '../../constants/urls';
import { getSupportPromptTranslations } from '../../contexts/supportPromptTranslations';
import { HeartIcon } from '../shared/HeartIcon';
import { TooltipButton } from '../shared/TooltipButton';

interface SettingsVersionFooterProps {
  versionLabel: string;
  changelogTooltip: string;
  language?: string;
  onOpenChangelog: () => void;
  onOpenDonate?: (url: string) => void;
}

export function SettingsVersionFooter({ versionLabel, changelogTooltip, language, onOpenChangelog, onOpenDonate }: SettingsVersionFooterProps) {
  const support = getSupportPromptTranslations(language);
  const openDonate = () => {
    if (onOpenDonate) onOpenDonate(DONATE_URL);
    else window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="settings-navigation__footer">
      {versionLabel && (
        <TooltipButton
          type="button"
          className="settings-navigation__version"
          onClick={onOpenChangelog}
          tooltip={changelogTooltip}
          tooltipPos="above"
          tooltipAlign="left"
        >
          {versionLabel}
        </TooltipButton>
      )}
      <TooltipButton
        type="button"
        className="settings-navigation__donate"
        onClick={openDonate}
        tooltip={support.homeSupportTitle}
        tooltipPos="above"
        tooltipAlign="right"
      >
        <HeartIcon size={12} />
        <span>{support.donateButton}</span>
      </TooltipButton>
    </div>
  );
}
