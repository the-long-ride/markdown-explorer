import { useLayoutEffect, type RefObject } from 'react';
import {
  getActiveDocumentRootId,
  registerDocumentRoot,
  setActiveDocumentRootId,
  type DocumentRootId,
} from './activeDocumentRoot';

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
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    return registerDocumentRoot({ id, body, scroll: scrollRef.current, filePath, markdownSource });
  }, [bodyRef, filePath, id, markdownSource, renderVersion, scrollRef]);

  useLayoutEffect(() => {
    if (!active) return;
    const previousId = getActiveDocumentRootId();
    setActiveDocumentRootId(id);
    return () => {
      if (getActiveDocumentRootId() === id && previousId !== id) {
        setActiveDocumentRootId(previousId);
      }
    };
  }, [active, id]);
}
