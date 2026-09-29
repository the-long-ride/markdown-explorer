export interface SidebarItemMenuPositionInput {
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'right'> & Partial<Pick<DOMRect, 'left'>>;
  sidebarRect: Pick<DOMRect, 'left' | 'right'>;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
  align?: 'right' | 'left';
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
  align = 'right',
}: SidebarItemMenuPositionInput): SidebarItemMenuPosition {
  const maxSidebarLeft = Math.max(
    sidebarRect.left + margin,
    sidebarRect.right - (menuWidth + margin),
  );
  let targetLeft = anchorRect.right - menuWidth;
  if (align === 'left') {
    targetLeft = anchorRect.left !== undefined ? anchorRect.left : sidebarRect.left + margin;
  }
  const left = Math.max(
    sidebarRect.left + margin,
    Math.min(targetLeft, maxSidebarLeft, viewportWidth - menuWidth - margin),
  );
  const belowTop = anchorRect.bottom + gap;
  const canFitBelow = belowTop + menuHeight <= viewportHeight - margin;
  const top = canFitBelow
    ? belowTop
    : Math.max(margin, anchorRect.top - gap - menuHeight);
  return { left, top, placement: canFitBelow ? 'below' : 'above' };
}
