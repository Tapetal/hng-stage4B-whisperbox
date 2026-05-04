'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { loadKeyPair, generateKeyPair, storeKeyPair } from '@/lib/crypto/keys';
import { saveSession } from '@/lib/store/session';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setLoading(true);
    try {
      const { token, user } = await authApi.login({ email: email.trim(), password });

      // Check if we have keys for this user; if not, regenerate
      // (handles case where user logs in on new device)
      const existing = await loadKeyPair(user.id);
      if (!existing) {
        // Keys are device-local — on new device, messages from old device
        // cannot be decrypted. This is the forward secrecy trade-off.
        const kp = await generateKeyPair();
        await storeKeyPair(user.id, kp);
      }

      saveSession({ token, user });
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
        <div role="alert" className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
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
