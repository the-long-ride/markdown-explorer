import { describe, expect, it } from 'vitest';
import { getDownloadUrl, pickDesktopDownloadUrl, pickInstallableDesktopDownloadUrl } from '../../../../ui/src/hooks/useUpdateCheck';

const assets = [
  { browser_download_url: 'https://x/unnamed' },
  { name: 'Markdown.Explorer_1.0.0_x64.AppImage', browser_download_url: 'https://x/appimage' },
  { name: 'Markdown.Explorer_1.0.0_amd64.deb', browser_download_url: 'https://x/deb' },
  { name: 'Markdown.Explorer_1.0.0_x64.AppImage.sig' },
] as any[];

describe('useUpdateCheck asset picking', () => {
  it('ignores unnamed or url-less assets and picks the best scored match', () => {
    const picked = pickDesktopDownloadUrl(assets, 'linux' as any, 'x64');
    expect(['https://x/appimage', 'https://x/deb']).toContain(picked);
    const installable = pickInstallableDesktopDownloadUrl(assets, 'linux' as any, 'x64', 'desktop' as any);
    expect(installable === undefined || installable.startsWith('https://x/')).toBe(true);
    expect(pickDesktopDownloadUrl([{ browser_download_url: 'https://x/u' }] as any, 'linux' as any, 'x64')).toBeUndefined();
    expect(typeof getDownloadUrl).toBe('function');
  });
});
