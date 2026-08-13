import { GlobeIcon } from './WelcomePageIcons';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import type { HostPlatform } from '../../types';

type WelcomeHeroCopy = ReturnType<typeof getWelcomeTranslations>['hero'];

interface WelcomeHeroProps {
  copy: WelcomeHeroCopy;
  isDesktop: boolean;
  hostPlatform: HostPlatform;
  markdownThemLabel: string;
}

export function WelcomeHero({ copy, isDesktop, hostPlatform, markdownThemLabel }: WelcomeHeroProps) {
  return (
    <div className="hero-section">
      <h1 className="hero-title">{copy.title}</h1>
      <p className="hero-subtitle">{isDesktop ? copy.descDesktop : copy.descVSCode}</p>
      <div className="hero-meta">
        {copy.createdBy}{' '}<a href="https://github.com/the-long-ride" target="_blank" rel="noopener noreferrer">the-long-ride</a>{' '}
        with ❤️ - {copy.repository}:{' '}<a href="https://github.com/the-long-ride/markdown-explorer" target="_blank" rel="noopener noreferrer">markdown-explorer</a>{' '}
        - {copy.license}:{' '}<a href="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a>
      </div>
      <div className="homepage-link-container">
        <a href="https://the-long-ride.github.io/markdown-explorer" target="_blank" rel="noopener noreferrer" className="homepage-link">
          <GlobeIcon className="link-icon" /><span>https://the-long-ride.github.io/markdown-explorer</span>
        </a>
        <a href="https://the-long-ride.github.io/markdown-them" target="_blank" rel="noopener noreferrer" className="homepage-link">
          <GlobeIcon className="link-icon" /><span>{markdownThemLabel}</span>
        </a>
        {isDesktop && hostPlatform === 'macos' && (
          <a href="https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md" target="_blank" rel="noopener noreferrer" className="homepage-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="link-icon">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            <span>{copy.macosInstallBtn}</span>
          </a>
        )}
        {!isDesktop && (() => {
          const DOWNLOAD_URL = 'https://the-long-ride.github.io/markdown-explorer/#download';
          const { desktopRecommendation, desktopAppLinkText } = copy;
          const idx = desktopRecommendation.indexOf(desktopAppLinkText);
          if (idx === -1) {
            return <div className="desktop-recommendation">{desktopRecommendation}</div>;
          }
          const prefix = desktopRecommendation.slice(0, idx);
          const suffix = desktopRecommendation.slice(idx + desktopAppLinkText.length);
          return (
            <div className="desktop-recommendation">
              {prefix}
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="desktop-recommendation__link">
                {desktopAppLinkText}
              </a>
              {suffix}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
