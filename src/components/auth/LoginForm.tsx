'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { unwrapPrivateKey, storeWrappedKeyPair, importPublicKey } from '@/lib/crypto/keys';
import { saveSession } from '@/lib/store/session';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState<'idle' | 'unwrapping'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setLoading(true);

    try {
      const { accessToken, refreshToken, user } = await authApi.login({ username: username.trim(), password });

      if (!user.publicKey || !user.wrappedPrivateKey || !user.pbkdf2Salt) {
        throw new Error('Missing encryption key data for this account.');
      }

      setStep('unwrapping');
      let privateKey: CryptoKey;
      try {
        privateKey = await unwrapPrivateKey(user.wrappedPrivateKey, user.pbkdf2Salt, password);
      } catch {
        throw new Error('Wrong password — key decryption failed.');
      }

      const publicKey = await importPublicKey(user.publicKey);
      await storeWrappedKeyPair(user.id, publicKey, privateKey, user.wrappedPrivateKey, user.pbkdf2Salt);
      saveSession({ accessToken, refreshToken, user });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {step === 'unwrapping' && (
        <div className="flex items-center gap-3 text-xs font-medium text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-4 py-3">
          <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin flex-shrink-0" />
          Decrypting your private key…
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2.5 text-xs font-medium text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="login-username" className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
          Username
        </label>
        <input
          id="login-username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200"
          placeholder="alice_92"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 rounded-xl px-4 py-3 pr-11 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200"
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPw(s => !s)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors p-1">
            {showPw
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading || !username.trim() || !password}
        className="w-full relative overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
        style={{ background: loading ? '#059669' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: loading ? 'none' : '0 4px 24px rgba(16,185,129,0.25)' }}>
        {loading ? (
          <span className="flex items-center justify-center gap-2.5">
            <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            {step === 'unwrapping' ? 'Decrypting keys…' : 'Signing in…'}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        )}
      </button>

      <div className="flex items-center gap-2 text-[11px] text-zinc-600 bg-[#18181b] rounded-xl px-4 py-3 border border-[#27272a]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="text-emerald-500 flex-shrink-0">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Your private key is decrypted locally — never sent to our servers
      </div>
    </form>
  );
}