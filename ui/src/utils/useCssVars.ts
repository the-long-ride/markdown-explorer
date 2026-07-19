import { useLayoutEffect, type RefObject } from 'react';

export function useCssVars(
  ref: RefObject<HTMLElement | null>,
  variables: Record<string, string | number | undefined>,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    for (const [name, value] of Object.entries(variables)) {
      if (value === undefined) element.style.removeProperty(name);
      else element.style.setProperty(name, String(value));
    }
  }, [ref, variables]);
}
