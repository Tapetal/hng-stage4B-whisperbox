'use client';

import { useState, useEffect } from 'react';
import { loadSession, saveSession, clearSession } from '@/lib/store/session';
import { deleteKeyPair } from '@/lib/crypto/keys';
import type { Session } from '@/types';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = loadSession();
    setSession(s);
    setLoading(false);
  }, []);

  function signIn(s: Session) {
    saveSession(s);
    setSession(s);
  }

  async function signOut() {
    if (session?.user.id) {
      // Keys stay in IndexedDB for now unless user explicitly wants to clear
      // In production you'd offer a "sign out and clear keys" option
    }
    clearSession();
    setSession(null);
  }

  return { session, loading, signIn, signOut };
}
