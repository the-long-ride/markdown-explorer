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
import { LightbulbIcon } from './WelcomePageIcons';

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
      <div className="welcome-random-tip-card">
        <div className="welcome-random-tip-header">
          <div className="welcome-random-tip-tag">
            <LightbulbIcon className="card-icon" />
            <span>Tip & Practice of the Moment</span>
            {selectedRandomTip.item.badge && (
              <span className="welcome-random-tip-badge">{selectedRandomTip.item.badge}</span>
            )}
          </div>
          <div className="welcome-random-tip-actions">
            <button
              type="button"
              className="welcome-random-tip-shuffle-btn"
              onClick={handleShuffleTip}
              title="Shuffle Another Tip"
            >
              <span>🎲 Another Tip</span>
            </button>
          </div>
        </div>
        <div className="welcome-random-tip-body">
          <div className="welcome-random-tip-icon">
            {getTipIcon(selectedRandomTip.globalIndex)}
          </div>
          <div className="welcome-random-tip-content">
            <h3 className="welcome-random-tip-title">{selectedRandomTip.item.title}</h3>
            <div className="welcome-random-tip-desc">
              {renderWelcomeDescription(selectedRandomTip.item.desc)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
