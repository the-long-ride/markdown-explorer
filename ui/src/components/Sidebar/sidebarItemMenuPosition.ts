export interface SidebarItemMenuPositionInput {
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'right'>;
  sidebarRect: Pick<DOMRect, 'left' | 'right'>;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
}

export interface SidebarItemMenuPosition {
  left: number;
  top: number;
  placement: 'below' | 'above';
}

export function computeSidebarItemMenuPosition({
  anchorRect,
  sidebarRect,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  gap = 4,
  margin = 8,
}: SidebarItemMenuPositionInput): SidebarItemMenuPosition {
  const left = Math.max(
    sidebarRect.left + margin,
    Math.min(anchorRect.right - menuWidth, viewportWidth - menuWidth - margin),
  );
  const belowTop = anchorRect.bottom + gap;
  const canFitBelow = belowTop + menuHeight <= viewportHeight - margin;
  const top = canFitBelow
    ? belowTop
    : Math.max(margin, anchorRect.top - gap - menuHeight);
  return { left, top, placement: canFitBelow ? 'below' : 'above' };
}
