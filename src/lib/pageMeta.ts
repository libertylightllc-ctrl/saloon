/**
 * The browser tab title and the page description per page (website brief 1.2). The site is one HTML page, so each
 * page sets them while it is open and puts the default back when it closes. Web only.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

const DEFAULT_TITLE = 'Saloqo';

function setDescription(content: string | null) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  const original = tag.getAttribute('data-default') ?? tag.getAttribute('content') ?? '';
  if (!tag.hasAttribute('data-default')) tag.setAttribute('data-default', original);
  tag.setAttribute('content', content ?? original);
}

export function usePageMeta(title: string | null, description?: string | null) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !title) return;
    document.title = title;
    setDescription(description ?? null);
    return () => {
      document.title = DEFAULT_TITLE;
      setDescription(null);
    };
  }, [title, description]);
}
