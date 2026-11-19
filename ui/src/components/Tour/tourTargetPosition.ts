export interface TourCoords {
  readonly spotTop: number;
  readonly spotLeft: number;
  readonly spotWidth: number;
  readonly spotHeight: number;
  readonly cardTop: number;
  readonly cardLeft: number;
}

export const INITIAL_TOUR_COORDS: TourCoords = {
  spotTop: 0,
  spotLeft: 0,
  spotWidth: 0,
  spotHeight: 0,
  cardTop: 0,
  cardLeft: 0,
};

/**
 * Checks whether two tour spotlight/card coordinate objects have identical numeric values.
 */
export function areTourCoordsEqual(a: TourCoords, b: TourCoords): boolean {
  return (
    a.spotTop === b.spotTop &&
    a.spotLeft === b.spotLeft &&
    a.spotWidth === b.spotWidth &&
    a.spotHeight === b.spotHeight &&
    a.cardTop === b.cardTop &&
    a.cardLeft === b.cardLeft
  );
}

/**
 * Finds the first visible target element matching `targetSelector` and computes
 * spotlight + tooltip card coordinates within the current viewport.
 */
export function computeTourTargetCoords(targetSelector: string): TourCoords | null {
  let foundEl: HTMLElement | null = null;
  const candidates = document.querySelectorAll<HTMLElement>(targetSelector);
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      foundEl = el;
      break;
    }
  }
  if (!foundEl && candidates.length > 0) {
    foundEl = candidates[0];
  }
  if (!foundEl) return null;

  foundEl.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  const rect = foundEl.getBoundingClientRect();
  const pad = 8;
  const spotTop = Math.max(0, rect.top - pad);
  const spotLeft = Math.max(0, rect.left - pad);
  const spotWidth = Math.max(0, rect.width + pad * 2);
  const spotHeight = Math.max(0, rect.height + pad * 2);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const cardWidth = 360;
  const cardHeight = 220;

  let cardTop = spotTop + spotHeight + 12;
  if (cardTop + cardHeight > vh - 20) {
    cardTop = Math.max(20, spotTop - cardHeight - 12);
  }
  let cardLeft = spotLeft + spotWidth / 2 - cardWidth / 2;
  cardLeft = Math.max(20, Math.min(vw - cardWidth - 20, cardLeft));

  return {
    spotTop,
    spotLeft,
    spotWidth,
    spotHeight,
    cardTop,
    cardLeft,
  };
}
