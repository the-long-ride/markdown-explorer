import type { Translations } from '../../contexts/translations';
import whiteShibaBlep from '../../assets/themes/pets/backgrounds/white-shiba-blep.png';
import kInkSurprise from '../../assets/themes/pets/backgrounds/k-ink-surprise.png';
import catBlep from '../../assets/themes/pets/backgrounds/cat-blep.png';
import hamsterBlep from '../../assets/themes/pets/backgrounds/hamster-blep.png';
import corgiBlep from '../../assets/themes/pets/backgrounds/corgi-blep.png';

export const PET_BLEP_URLS = {
  'pet-white-shiba': whiteShibaBlep,
  'pet-k-ink': kInkSurprise,
  'pet-cat': catBlep,
  'pet-hamster': hamsterBlep,
  'pet-corgi': corgiBlep,
};

export const BANNED_SHORTCUTS: Record<string, keyof Translations> = {
  'Ctrl+Space': 'bannedShortcutImeMessage',
};

export function formatCurrentVersion(version: string): string {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  return match ? `v${match[1]}.${match[2]}.${match[3]}` : '';
}
