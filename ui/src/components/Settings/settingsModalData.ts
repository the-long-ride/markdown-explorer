import type { Translations } from '../../contexts/translations';
import { version as bundledVersion } from '../../../package.json';
import nikaAngry from '../../assets/themes/pets/backgrounds/nika-angry.png';
import kInkSurprise from '../../assets/themes/pets/backgrounds/k-ink-surprise.png';

export const PET_BLEP_URLS = {
  'pet-white-shiba': nikaAngry,
  'pet-k-ink': kInkSurprise,
};

export const BANNED_SHORTCUTS: Record<string, keyof Translations> = {
  'Ctrl+Space': 'bannedShortcutImeMessage',
};

export function resolveVersionNumber(version?: string): string {
  const trimmed = (version ?? '').trim();
  if (!trimmed || trimmed === '0.0.0' || /^\(?demo\)?$/i.test(trimmed)) {
    return bundledVersion;
  }
  return trimmed.replace(/\s*\(demo\)\s*/gi, '').trim() || bundledVersion;
}

export function formatCurrentVersion(version?: string): string {
  const resolved = resolveVersionNumber(version);
  const match = resolved.match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  if (match) {
    return `v${match[1]}.${match[2]}.${match[3]}`;
  }
  return resolved;
}
