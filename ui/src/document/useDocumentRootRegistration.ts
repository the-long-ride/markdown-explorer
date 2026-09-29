import { useEffect, type RefObject } from 'react';
import { registerDocumentRoot, setActiveDocumentRootId, type DocumentRootId } from './activeDocumentRoot';

interface DocumentRootRegistrationArgs {
  id: DocumentRootId;
  bodyRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  filePath: string | null;
  markdownSource: string | null;
  renderVersion: number;
  active?: boolean;
}

export function useDocumentRootRegistration({
  id,
  bodyRef,
  scrollRef,
  filePath,
  markdownSource,
  renderVersion,
  active,
}: DocumentRootRegistrationArgs): void {
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    return registerDocumentRoot({ id, body, scroll: scrollRef.current, filePath, markdownSource });
  }, [bodyRef, filePath, id, markdownSource, renderVersion, scrollRef]);

  useEffect(() => {
    if (active) setActiveDocumentRootId(id);
  }, [active, id]);
}
