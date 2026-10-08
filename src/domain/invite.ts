export const INVITE_ORIGIN = 'https://oskilifts.com';
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PENDING_INVITE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The shareable link for a person: oskilifts.com/u/<username>. */
export function inviteUrl(username: string): string {
  return `${INVITE_ORIGIN}/u/${username}`;
}

/** The short form printed on the share card, without the protocol. */
export function inviteLabel(username: string): string {
  return `oskilifts.com/u/${username}`;
}

export function inviteMessage(username: string): string {
  return `Lift with me on OSKILIFTS, the gym app for Berkeley. Follow me: ${inviteUrl(username)}`;
}

function clean(candidate: string | undefined): string | null {
  if (!candidate) return null;
  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  const username = decoded.trim().toLowerCase();
  return USERNAME_RE.test(username) ? username : null;
}

/**
 * Pulls the inviter's username out of a link, or null when the link is not an
 * invite. Accepts https://oskilifts.com/u/name (any host, since on the web it is
 * simply the page address), oskilifts://u/name, and Expo Go's exp://host/--/u/name.
 * Anything else, or any extra path, is ignored: this is input a stranger controls.
 */
export function parseInviteUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 500) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const protocol = parsed.protocol;
  if (protocol === 'oskilifts:') {
    // oskilifts://u/<name> has "u" as the host.
    const segments = parsed.pathname.split('/').filter(Boolean);
    return parsed.hostname === 'u' && segments.length === 1 ? clean(segments[0]) : null;
  }
  if (protocol !== 'https:' && protocol !== 'http:' && protocol !== 'exp:') return null;
  let segments = parsed.pathname.split('/').filter(Boolean);
  if (protocol === 'exp:') {
    // exp://127.0.0.1:8083/--/u/<name> (development)
    if (segments[0] !== '--') return null;
    segments = segments.slice(1);
  }
  return segments.length === 2 && segments[0] === 'u' ? clean(segments[1]) : null;
}

export interface PendingInvite {
  username: string;
  savedAt: number;
}

/** A stored pending invite, validated: bad shapes and old ones are dropped. */
export function validatePendingInvite(raw: unknown, now: number = Date.now()): PendingInvite | null {
  if (!raw || typeof raw !== 'object') return null;
  const { username, savedAt } = raw as Record<string, unknown>;
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  if (now - savedAt > PENDING_INVITE_MAX_AGE_MS || savedAt - now > 60_000) return null;
  return { username, savedAt };
}
