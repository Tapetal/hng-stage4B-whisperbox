'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import {
  unwrapPrivateKey,
  storeWrappedKeyPair,
  importPublicKey, // 👈 use this instead of manual atob
} from '@/lib/crypto/keys';
import { saveSession } from '@/lib/store/session';

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      const { accessToken, refreshToken, user } = await authApi.login({
        username: username.trim(),
        password,
      });

      // ✅ validate key data exists
      if (!user.publicKey || !user.wrappedPrivateKey || !user.pbkdf2Salt) {
        throw new Error('Missing encryption key data for this account.');
      }

      // 🔐 UNWRAP PRIVATE KEY (with debug)
      let privateKey;
      try {
        privateKey = await unwrapPrivateKey(
          user.wrappedPrivateKey,
          user.pbkdf2Salt,
          password
        );
      } catch (e: any) {
        alert(
          'UNWRAP FAILED: ' +
            (e?.name || 'Error') +
            ' - ' +
            (e?.message || JSON.stringify(e))
        );
        throw new Error('Failed to restore your encryption keys.');
      }

      // 🔐 IMPORT PUBLIC KEY (SAFE — no atob hacks)
      const publicKey = await importPublicKey(user.publicKey);

      // 💾 Store keys
      await storeWrappedKeyPair(
        user.id,
        publicKey,
        privateKey,
        user.wrappedPrivateKey,
        user.pbkdf2Salt
      );

      // 💾 Save session (no need to re-export public key)
      saveSession({
        accessToken,
        refreshToken,
        user,
      });

      // 🚀 Redirect
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="login-username"
          className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide"
        >
          Username
        </label>
        <input
          id="login-username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
          placeholder="alice"
        />
      </div>

      <div>
        <label
          htmlFor="login-password"
          className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide"
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1c]"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}