import { useEffect, useState } from 'react';

interface TreeRef {
  readonly current: HTMLDivElement | null;
}

export function useLocateActiveFile(treeRef: TreeRef): number {
  const [locateRequest, setLocateRequest] = useState(0);

  useEffect(() => {
    const handleLocateScroll = () => {
      setLocateRequest((request) => request + 1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          treeRef.current
            ?.querySelector('.tree-file.is-active')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    };
    window.addEventListener('locate-active-file', handleLocateScroll);
    return () => window.removeEventListener('locate-active-file', handleLocateScroll);
  }, [treeRef]);

  return locateRequest;
}
