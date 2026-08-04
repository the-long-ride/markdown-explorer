// =============================================================================
// components/Content/RandomTipCard.tsx
// Centered Random Tip Card displayed when user closes all document files
// =============================================================================

import { useMemo, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { buildWelcomeTipGroups } from './welcomeTipGroups';
import { getTipIcon } from './welcomePageHelpers';
import { renderWelcomeDescription } from './renderWelcomeDescription';

function DiceIcon({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function RandomTipCard() {
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const wt = getWelcomeTranslations(currentLang);

  const tipGroups = useMemo(
    () => buildWelcomeTipGroups(currentLang, state.settings, wt.tips),
    [currentLang, state.settings, wt.tips],
  );

  const allTips = useMemo(() => {
    const items: Array<{ groupTitle: string; item: import('./welcomeTipsContent').TipItem; globalIndex: number }> = [];
    let idx = 0;
    tipGroups.forEach((group) => {
      group.items.forEach((item) => {
        items.push({ groupTitle: group.title, item, globalIndex: idx++ });
      });
    });
    return items;
  }, [tipGroups]);

  const [randomTipIndex, setRandomTipIndex] = useState(() => {
    return allTips.length > 0 ? Math.floor(Math.random() * allTips.length) : 0;
  });

  const handleShuffleTip = () => {
    if (allTips.length <= 1) return;
    setRandomTipIndex((prev) => {
      let next = Math.floor(Math.random() * allTips.length);
      while (next === prev) {
        next = Math.floor(Math.random() * allTips.length);
      }
      return next;
    });
  };

  const selectedRandomTip = allTips[randomTipIndex] || allTips[0];

  if (!selectedRandomTip) return null;

  return (
    <div className="empty-workspace-tip-screen" data-testid="empty-workspace-random-tip">
      <div className="tip-card welcome-random-tip-card">
        <div className="tip-card-header">
          <h3 className="tip-card-title">
            {getTipIcon(selectedRandomTip.globalIndex)}
            {selectedRandomTip.item.title}
          </h3>
          <div className="tip-card-header-actions">
            {selectedRandomTip.item.badge && (
              <span className="tip-card-badge">{selectedRandomTip.item.badge}</span>
            )}
            <button
              type="button"
              className="welcome-random-tip-shuffle-btn"
              onClick={handleShuffleTip}
              title="Another Tip"
              aria-label="Another Tip"
            >
              <DiceIcon size={14} />
              <span>Another Tip</span>
            </button>
          </div>
        </div>
        <div className="tip-card-desc tip-card-desc--multiline">
          {renderWelcomeDescription(selectedRandomTip.item.desc)}
        </div>
      </div>
    </div>
  );
}
