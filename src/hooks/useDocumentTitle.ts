import { useEffect } from 'react';

/**
 * Sets the browser tab title while the component is mounted, and puts the previous
 * one back after. Pass null to leave the title alone (for a page that sets its own).
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title === null) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
