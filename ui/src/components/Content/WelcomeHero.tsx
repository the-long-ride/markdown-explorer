import { useState } from 'react';
import { ArrowRightIcon, GlobeIcon, SparklesIcon } from './WelcomePageIcons';
import { StarIcon } from '../shared/icons';
import { HeartIcon } from '../shared/HeartIcon';
import { DONATE_URL, GITHUB_REPO_URL } from '../../constants/urls';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getSupportPromptTranslations } from '../../contexts/supportPromptTranslations';
import { getTourTranslations } from '../Tour/tourTranslations';
import { requestStartUserTour } from '../Tour/tourEvents';
import { useGitHubStars } from '../../hooks/useGitHubStars';
import type { HostPlatform } from '../../types';

type WelcomeHeroCopy = ReturnType<typeof getWelcomeTranslations>['hero'];

interface WelcomeHeroProps {
  copy: WelcomeHeroCopy;
  isDesktop: boolean;
  hostPlatform: HostPlatform;
  markdownThemLabel: string;
  language?: string;
}

const ECOSYSTEM_REPOS = [
  {
    name: 'markdown-them',
    tags: ['Doc Converter', 'Local-First', 'Zero-Cloud'],
    url: 'https://the-long-ride.github.io/markdown-them',
    desc: 'Privacy-first document converter turning PDF, DOCX, XLSX, PPTX, and HTML into clean Markdown.',
  },
  {
    name: 'aevra',
    tags: ['MCP Gateway', 'Tool Proxy', 'Agent Hub'],
    url: 'https://github.com/the-long-ride/aevra',
    desc: 'Local MCP execution gateway & proxy aggregator for AI assistants and coding agents.',
  },
  {
    name: 'aevra-desktop-use',
    tags: ['Desktop MCP', 'Mouse-Free', 'App Allowlist'],
    url: 'https://github.com/the-long-ride/aevra-desktop-use',
    desc: 'Mouse-free background desktop automation MCP server with native app allowlist & activity log.',
  },
  {
    name: 'aevra-browser-use',
    tags: ['Browser MCP', 'Tab-Targeted', 'Extension & CDP'],
    url: 'https://github.com/the-long-ride/aevra-browser-use',
    desc: 'Tab-targeted, mouse-free browser automation daemon for MCP clients via extension or CDP.',
  },
  {
    name: 'engram',
    tags: ['Agent Memory', 'Git-Synced', 'Semantic Search'],
    url: 'https://github.com/the-long-ride/engram',
    desc: 'Portable memory layer for AI agents — searchable, reviewable, and synced with Git.',
  },
  {
    name: 'quotashift',
    tags: ['Quota HUD', 'Multi-Account', 'AI Usage'],
    url: 'https://github.com/the-long-ride/QuotaShift',
    desc: 'Desktop quota monitor, HUD overlay, and account switcher for AI coding tools.',
  },
] as const;

export function WelcomeHero({ copy, isDesktop, hostPlatform, markdownThemLabel, language }: WelcomeHeroProps) {
  const [isEcosystemOpen, setIsEcosystemOpen] = useState(false);
  const starCount = useGitHubStars();
  const supportT = getSupportPromptTranslations(language);
  const tourT = getTourTranslations(language);
  const websiteUrl = 'https://the-long-ride.github.io/markdown-explorer';
  const macosInstallUrl = 'https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md';

  return (
    <div className="hero-section welcome-command-hero" data-tour-id="welcome-hero">
      <div className="welcome-command-hero__main">
        <h1 className="hero-title">{copy.title}</h1>
        <p className="hero-subtitle">{isDesktop ? copy.descDesktop : copy.descVSCode}</p>
        <div className="hero-meta">
          <div className="hero-meta__row">
            <span>{copy.createdBy}</span>{' '}
            <a
              href="https://github.com/the-long-ride"
              target="_blank"
              rel="noopener noreferrer"
              data-hover-tooltip="https://github.com/the-long-ride"
              data-hover-tooltip-pos="top"
            >
              the-long-ride
            </a>{' '}
            <span>with ❤️</span>
          </div>
          <div className="hero-meta__row">
            <span>{copy.repository}:</span>{' '}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-hover-tooltip={GITHUB_REPO_URL}
              data-hover-tooltip-pos="top"
            >
              markdown-explorer
            </a>
            <span className="hero-meta__dot" aria-hidden="true">•</span>
            <span>{copy.license}:</span>{' '}
            <a
              href="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              data-hover-tooltip="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE"
              data-hover-tooltip-pos="top"
            >
              MIT
            </a>
          </div>
        </div>

        <div className="homepage-link-container">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="homepage-link homepage-link--compact"
            data-hover-tooltip={websiteUrl}
            data-hover-tooltip-pos="top"
            aria-label={`Website (${websiteUrl})`}
          >
            <GlobeIcon className="link-icon" />
            <span>Website</span>
          </a>
          {isDesktop && hostPlatform === 'macos' && (
            <a
              href={macosInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="homepage-link homepage-link--compact"
              data-hover-tooltip={macosInstallUrl}
              data-hover-tooltip-pos="top"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="link-icon">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              <span>{copy.macosInstallBtn}</span>
            </a>
          )}
          <button
            type="button"
            className="welcome-tour-trigger-btn"
            data-tour-id="tour-trigger"
            onClick={requestStartUserTour}
            data-hover-tooltip={`${tourT.startTour} — ${tourT.startTourHint}`}
            data-hover-tooltip-pos="top"
          >
            <SparklesIcon className="welcome-tour-trigger-btn__icon" />
            <span className="welcome-tour-trigger-btn__label">{tourT.startTour}</span>
            <span className="welcome-tour-trigger-btn__badge">{tourT.startTourHint}</span>
          </button>
        </div>

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
              <a
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="desktop-recommendation__link"
                data-hover-tooltip={DOWNLOAD_URL}
                data-hover-tooltip-pos="top"
              >
                {desktopAppLinkText}
              </a>
              {suffix}
            </div>
          );
        })()}

        <div className="hero-support-banner hero-star-banner" role="region" aria-label={supportT.homeSupportTitle}>
          <div className="hero-support-banner__content hero-star-banner__content">
            <HeartIcon size={16} className="hero-support-banner__icon hero-star-banner__icon" />
            <span className="hero-support-banner__text hero-star-banner__text">{supportT.homeSupportMessage}</span>
          </div>
          <div className="hero-support-banner__actions">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-support-banner__btn hero-star-banner__btn"
              data-hover-tooltip={GITHUB_REPO_URL}
              data-hover-tooltip-pos="top"
            >
              <StarIcon size={13} />
              <span>{supportT.homeSupportButton}</span>
              {typeof starCount === 'number' && starCount > 0 && (
                <span className="hero-star-banner__count" data-testid="github-star-count">
                  {starCount.toLocaleString()}
                </span>
              )}
            </a>
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-support-banner__btn hero-support-banner__btn--donate"
              data-hover-tooltip={DONATE_URL}
              data-hover-tooltip-pos="top"
            >
              <HeartIcon size={13} />
              <span>{supportT.donateButton}</span>
            </a>
          </div>
        </div>

        <section className="welcome-ecosystem" aria-label="More Open-Source Projects">
          <div className="welcome-ecosystem__header">
            <button
              type="button"
              className="welcome-ecosystem__toggle"
              aria-expanded={isEcosystemOpen}
              data-testid="welcome-ecosystem-toggle"
              onClick={() => setIsEcosystemOpen((prev) => !prev)}
            >
              <svg
                className={`welcome-ecosystem__chevron${isEcosystemOpen ? ' is-open' : ''}`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="welcome-ecosystem__title">Open-Source Ecosystem</span>
              <span className="welcome-ecosystem__count">{ECOSYSTEM_REPOS.length}</span>
            </button>
            <a
              href="https://github.com/the-long-ride"
              target="_blank"
              rel="noopener noreferrer"
              className="welcome-ecosystem__author"
              data-hover-tooltip="https://github.com/the-long-ride"
              data-hover-tooltip-pos="top"
            >
              @the-long-ride
            </a>
          </div>
          {isEcosystemOpen && (
            <div className="welcome-ecosystem__list">
              {ECOSYSTEM_REPOS.map((repo) => (
                <a
                  key={repo.name}
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="welcome-ecosystem__item"
                  data-hover-tooltip={repo.name === 'markdown-them' ? `${repo.url} — ${markdownThemLabel}` : repo.url}
                  data-hover-tooltip-pos="right"
                  aria-label={repo.name === 'markdown-them' ? markdownThemLabel : repo.name}
                >
                  <div className="welcome-ecosystem__item-head">
                    <span className="welcome-ecosystem__item-name">{repo.name}</span>
                    <ArrowRightIcon className="welcome-ecosystem__item-arrow" />
                  </div>
                  <div className="welcome-ecosystem__item-tags">
                    {repo.tags.map((tag) => (
                      <span key={tag} className="welcome-ecosystem__item-tag">{tag}</span>
                    ))}
                  </div>
                  <p className="welcome-ecosystem__item-desc">{repo.desc}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
