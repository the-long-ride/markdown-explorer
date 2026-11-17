import { isWebRuntime } from '../../insights/runtimeCapabilities';
import { useGitHubStars } from '../../hooks/useGitHubStars';
import { TooltipButton } from '../shared/TooltipButton';

const GITHUB_REPO_URL = 'https://github.com/the-long-ride/markdown-explorer';

export function resolveWebsitePageUrl(page: string, currentPathname?: string): string {
  const pathname = currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const cleanPath = pathname.replace(/\\/g, '/');
  if (
    cleanPath.endsWith('/app/') ||
    cleanPath.endsWith('/app/index.html') ||
    cleanPath.endsWith('/app') ||
    cleanPath.includes('/app/')
  ) {
    return `../${page}`;
  }
  return `./${page}`;
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function ModeSwitchIcon({ isTestMode }: { isTestMode: boolean }) {
  if (isTestMode) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function FeaturesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function TermsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export function WebDemoNavActions() {
  const isWeb = isWebRuntime();
  const starsCount = useGitHubStars();

  if (!isWeb) {
    return null;
  }

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isTestMode = searchParams.get('mode') === 'test';
  const modeLabel = isTestMode ? 'Markdown Explorer on Web' : 'Mode Test';

  const handleModeSwitch = () => {
    if (typeof window === 'undefined') return;
    window.location.href = isTestMode ? '?mode=web' : '?mode=test';
  };

  const handleNavigate = (page: string) => {
    if (typeof window === 'undefined') return;
    window.location.href = resolveWebsitePageUrl(page);
  };

  const handleOpenGitHub = () => {
    if (typeof window === 'undefined') return;
    window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="web-demo-nav" data-testid="web-demo-nav">
      <TooltipButton
        className="btn btn--secondary btn--icon web-demo-nav__btn web-demo-nav__btn--mode"
        data-testid="web-demo-nav-mode"
        tooltip={modeLabel}
        label={modeLabel}
        onlyIcon={true}
        icon={<ModeSwitchIcon isTestMode={isTestMode} />}
        onClick={handleModeSwitch}
      />
      <TooltipButton
        className="btn btn--secondary btn--icon web-demo-nav__btn"
        data-testid="web-demo-nav-download"
        tooltip="Download"
        label="Download"
        onlyIcon={true}
        icon={<DownloadIcon />}
        onClick={() => handleNavigate('landing.html#download')}
      />
      <TooltipButton
        className="btn btn--secondary btn--icon web-demo-nav__btn"
        data-testid="web-demo-nav-features"
        tooltip="Features"
        label="Features"
        onlyIcon={true}
        icon={<FeaturesIcon />}
        onClick={() => handleNavigate('landing.html#features')}
      />
      <TooltipButton
        className="btn btn--secondary btn--icon web-demo-nav__btn web-demo-nav__btn--github"
        data-testid="web-demo-nav-github"
        tooltip={starsCount !== null ? `GitHub (★ ${starsCount})` : 'GitHub'}
        label="GitHub"
        onlyIcon={true}
        icon={<GitHubIcon />}
        onClick={handleOpenGitHub}
      >
        {starsCount !== null && (
          <span className="web-demo-nav__stars-badge">★ {starsCount}</span>
        )}
      </TooltipButton>
      <TooltipButton
        className="btn btn--secondary btn--icon web-demo-nav__btn"
        data-testid="web-demo-nav-privacy"
        tooltip="Privacy"
        label="Privacy"
        onlyIcon={true}
        icon={<PrivacyIcon />}
        onClick={() => handleNavigate('privacy.html')}
      />
      <TooltipButton
        className="btn btn--secondary btn--icon web-demo-nav__btn"
        data-testid="web-demo-nav-terms"
        tooltip="Terms"
        label="Terms"
        onlyIcon={true}
        icon={<TermsIcon />}
        onClick={() => handleNavigate('terms.html')}
      />
    </div>
  );
}
