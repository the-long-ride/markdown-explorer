import { useEffect, useRef } from 'react';

export function useContentScrollMemory(
  currentFile: string | null,
  scrollRef: React.RefObject<HTMLDivElement | null>,
  onCapture?: (filePath: string, scrollTop: number) => void,
) {
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const lastFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastFileRef.current && scrollRef.current) {
      scrollPositionsRef.current[lastFileRef.current] = scrollRef.current.scrollTop;
      onCapture?.(lastFileRef.current, scrollRef.current.scrollTop);
    }
    lastFileRef.current = currentFile;
  }, [currentFile, onCapture, scrollRef]);

  return scrollPositionsRef;
}
