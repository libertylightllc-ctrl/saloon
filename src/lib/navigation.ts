/**
 * Where Back goes when there is no history — a refreshed web page or a phone opened from a link
 * or notification straight onto an inner screen. Always the screen it sits under in the app.
 */

/** Screens opened from More, whose parent is not in their path. */
const OPENED_FROM: Record<string, string> = { '/sales': '/more', '/services': '/more', '/accounts': '/more' };
/** Path prefixes that are folders, not screens. */
const FOLDER_PARENT: Record<string, string> = { '/settings': '/more', '/appointment': '/queue' };

export function parentPath(pathname: string): string {
  const clean = `/${pathname.split('?')[0]!.split('/').filter(Boolean).join('/')}`;
  if (OPENED_FROM[clean]) return OPENED_FROM[clean];
  const parent = clean.slice(0, clean.lastIndexOf('/')) || '/';
  return FOLDER_PARENT[parent] ?? parent;
}
