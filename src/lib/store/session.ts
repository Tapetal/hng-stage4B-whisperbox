/**
 * Session store.
 * Tokens live in sessionStorage, never localStorage.
 * Private keys stay in IndexedDB — see lib/crypto/keys.ts
 */

import type { Session, User } from '@/types';

const SESSION_KEY = 'wb_session';

// In-memory token (cleared on tab close)
let _accessToken: string | null = null;
let _user: User | null = null;

export function saveSession(session: Session): void {
  _accessToken = session.accessToken;
  _user  = session.user;
  // Persist just enough to restore after refresh (no sensitive data)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
  }));
}

export function loadSession(): Session | null {
  if (_accessToken && _user) {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const refreshToken = raw ? (JSON.parse(raw) as Session).refreshToken : '';
    return { accessToken: _accessToken, refreshToken, user: _user };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    _accessToken = parsed.accessToken;
    _user  = parsed.user;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  _accessToken = null;
  _user  = null;
  sessionStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  if (_accessToken) return _accessToken;
  const s = loadSession();
  return s?.accessToken ?? null;
}

export function getUser(): User | null {
  if (_user) return _user;
  const s = loadSession();
  return s?.user ?? null;
}

export function updateUser(user: User): void {
  _user = user;
  const session = loadSession();
  if (session) saveSession({ ...session, user });
}

export function updateAccessToken(accessToken: string): void {
  const session = loadSession();
  if (!session) return;
  saveSession({ ...session, accessToken });
}
