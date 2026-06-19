// =============================================================================
// lib/petImages.ts — Lazy-loaded pet image URLs (avoid loading 4.5MB at startup)
// =============================================================================
//
// Each pet has up to three expressions (happy, wink, blep). The CSS-based
// backgrounds use url() which the browser already loads on-demand. This module
// handles the JS-level image imports used in settings/theme picker previews.
//
// Dynamic import() ensures pet PNGs only load when the settings modal or
// theme picker is actually opened, not at cold start.
// =============================================================================

type PetKey =
  | 'pet-white-shiba'
  | 'pet-shiba'
  | 'pet-shiba-memes'
  | 'pet-k-ink'
  | 'pet-cat'
  | 'pet-hamster'
  | 'pet-corgi';

type PetExpression = 'happy' | 'wink' | 'blep' | 'surprise' | 'wolf';

// Map pet keys to their directory and file naming conventions
const PET_MAP: Record<PetKey, { dir: string; expressions: Partial<Record<PetExpression, string>> }> = {
  'pet-white-shiba': {
    dir: 'white-shiba',
    expressions: { happy: 'white-shiba-happy.png', wink: 'white-shiba-wink.png', blep: 'white-shiba-blep.png' },
  },
  'pet-shiba': {
    dir: 'shiba',
    expressions: { happy: 'shiba-happy.png', wink: 'shiba-wink.png', blep: 'shiba-blep.png' },
  },
  'pet-shiba-memes': {
    dir: 'shiba-memes',
    expressions: { happy: 'shiba-memes-happy.png', wink: 'shiba-memes-wink.png', blep: 'shiba-memes-blep.png' },
  },
  'pet-k-ink': {
    dir: 'k-ink',
    expressions: { surprise: 'k-ink-surprise.png', wolf: 'k-ink-wolf.png' },
  },
  'pet-cat': {
    dir: 'cat',
    expressions: { happy: 'cat-happy.png', wink: 'cat-wink.png', blep: 'cat-blep.png' },
  },
  'pet-hamster': {
    dir: 'hamster',
    expressions: { happy: 'hamster-happy.png', wink: 'hamster-wink.png', blep: 'hamster-blep.png' },
  },
  'pet-corgi': {
    dir: 'corgi',
    expressions: { happy: 'corgi-happy.png', wink: 'corgi-wink.png', blep: 'corgi-blep.png' },
  },
};

const imageCache = new Map<string, Promise<string>>();

function loadPetImage(dir: string, filename: string): Promise<string> {
  const cacheKey = `${dir}/${filename}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)!;

  const promise = import(
    `../../assets/themes/pets/backgrounds/${dir}/${filename}`
  ).then((mod) => mod.default as string);

  imageCache.set(cacheKey, promise);
  return promise;
}

/**
 * Get the URL for a pet's blep/surprise expression (used in settings preview).
 */
export function getPetBlepUrl(petKey: PetKey): Promise<string> {
  const pet = PET_MAP[petKey];
  const filename = pet.expressions.surprise ?? pet.expressions.blep ?? '';
  return loadPetImage(pet.dir, filename);
}

/**
 * Get the URL for a pet's happy/wolf expression (used in theme picker).
 */
export function getPetHappyUrl(petKey: PetKey): Promise<string> {
  const pet = PET_MAP[petKey];
  const filename = pet.expressions.wolf ?? pet.expressions.happy ?? '';
  return loadPetImage(pet.dir, filename);
}

/**
 * Bulk-load all pet URLs for a given expression. Returns a record of petKey → URL.
 */
export async function getAllPetBlepUrls(): Promise<Record<PetKey, string>> {
  const entries = await Promise.all(
    (Object.keys(PET_MAP) as PetKey[]).map(async (key) => {
      const url = await getPetBlepUrl(key);
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<PetKey, string>;
}

export async function getAllPetHappyUrls(): Promise<Record<PetKey, string>> {
  const entries = await Promise.all(
    (Object.keys(PET_MAP) as PetKey[]).map(async (key) => {
      const url = await getPetHappyUrl(key);
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<PetKey, string>;
}
