import { useEffect, useRef } from 'react';

export function useContentScrollMemory(
  currentFile: string | null,
  scrollRef: React.RefObject<HTMLDivElement | null>,
) {
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const lastFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastFileRef.current && scrollRef.current) {
      scrollPositionsRef.current[lastFileRef.current] = scrollRef.current.scrollTop;
    }
    lastFileRef.current = currentFile;
  }, [currentFile, scrollRef]);

  return scrollPositionsRef;
}
