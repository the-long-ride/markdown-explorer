import { memo, type RefObject } from 'react';
import { useScrollVisibility } from '../../hooks/useScrollVisibility';
import { ChevronUpIcon } from './icons';
import { TooltipButton } from './TooltipButton';

interface ScrollToTopButtonProps {
  scrollRef: RefObject<HTMLElement | null>;
  observeKey?: unknown;
  tooltip: string;
  withToc: boolean;
}

export const ScrollToTopButton = memo(function ScrollToTopButton({
  scrollRef,
  observeKey,
  tooltip,
  withToc,
}: ScrollToTopButtonProps) {
  const { isVisible, scrollToTop } = useScrollVisibility(scrollRef, 200, observeKey);

  return (
    <TooltipButton
      className={`scroll-to-top-btn${isVisible ? ' is-visible' : ''}${withToc ? ' scroll-to-top-btn--with-toc' : ''}`}
      onClick={scrollToTop}
      tooltip={tooltip}
      tooltipPos="above"
      tooltipAlign="right"
      icon={<ChevronUpIcon />}
    />
  );
});
