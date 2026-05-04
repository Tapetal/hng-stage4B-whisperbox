/**
 * Session store.
 * Token lives in memory only (never localStorage).
 * userId stored in sessionStorage to survive page refresh within the tab.
 * Private keys stay in IndexedDB — see lib/crypto/keys.ts
 */

import type { Session, User } from '@/types';

const SESSION_KEY = 'wb_session';

// In-memory token (cleared on tab close)
let _token: string | null = null;
let _user:  User  | null  = null;

export function saveSession(session: Session): void {
  _token = session.token;
  _user  = session.user;
  // Persist just enough to restore after refresh (no sensitive data)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    token: session.token,
    user:  session.user,
  }));
}

export function loadSession(): Session | null {
  if (_token && _user) return { token: _token, user: _user };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    _token = parsed.token;
    _user  = parsed.user;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  _token = null;
  _user  = null;
  sessionStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  if (_token) return _token;
  const s = loadSession();
  return s?.token ?? null;
}

export function getUser(): User | null {
  if (_user) return _user;
  const s = loadSession();
  return s?.user ?? null;
}

export function updateUser(user: User): void {
  _user = user;
  const token = _token ?? getToken();
  if (token) saveSession({ token, user });
}
