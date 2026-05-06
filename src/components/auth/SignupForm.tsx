'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { generateKeyPair, exportPublicKey, storeWrappedKeyPair, wrapPrivateKey } from '@/lib/crypto/keys';
import { saveSession } from '@/lib/store/session';

type Step = 'form' | 'keys' | 'registering';

const STEP_LABELS: Record<Step, string> = {
  form: 'Create vault',
  keys: 'Generating RSA-2048 key pair…',
  registering: 'Securing your vault…',
};

export default function SignupForm() {
  const router = useRouter();
  const [username, setUsername]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword]       = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState<Step>('form');
  const [pwStrength, setPwStrength]   = useState(0);

  function checkStrength(pw: string) {
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    setPwStrength(s);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || password.length < 8) return;
    setError(null);
    setLoading(true);
    setStep('keys');

    try {
      const keyPair      = await generateKeyPair();
      const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
      const { wrappedPrivateKey, pbkdf2Salt } = await wrapPrivateKey(keyPair.privateKey, password);

      setStep('registering');
      const { accessToken, refreshToken, user } = await authApi.signup({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
        password,
        publicKey: publicKeyB64,
        wrappedPrivateKey,
        pbkdf2Salt,
      });

      await storeWrappedKeyPair(user.id, keyPair.publicKey, keyPair.privateKey, wrappedPrivateKey, pbkdf2Salt);
      saveSession({ accessToken, refreshToken, user });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
  const strengthLabels = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {loading && (
        <div className="flex items-center gap-3 text-xs font-medium text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-4 py-3">
          <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin flex-shrink-0" />
          {STEP_LABELS[step]}
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

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <label htmlFor="s-username" className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Username</label>
          <input id="s-username" type="text" autoComplete="username" required value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
            placeholder="alice_92" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label htmlFor="s-display" className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            Display name <span className="text-zinc-700 normal-case font-normal">(optional)</span>
          </label>
          <input id="s-display" type="text" autoComplete="name" value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
            placeholder="Alice" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="s-password" className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
          Password <span className="text-zinc-700 normal-case font-normal">— used to encrypt your private key</span>
        </label>
        <div className="relative">
          <input id="s-password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
            value={password}
            onChange={e => { setPassword(e.target.value); checkStrength(e.target.value); }}
            className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 rounded-xl px-4 py-3 pr-11 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
            placeholder="Min. 8 characters" />
          <button type="button" onClick={() => setShowPw(s => !s)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors p-1">
            {showPw
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>

        {password.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <div key={n} className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ background: n <= pwStrength ? strengthColors[pwStrength] : '#27272a' }} />
              ))}
            </div>
            <p className="text-[11px] font-medium" style={{ color: strengthColors[pwStrength] || '#52525b' }}>
              {strengthLabels[pwStrength]}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 text-[11px] leading-relaxed text-zinc-600 bg-[#18181b] rounded-xl px-4 py-3.5 border border-[#27272a]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="text-emerald-500 flex-shrink-0 mt-0.5">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>RSA-2048 key pair generated <strong className="text-zinc-400">on your device</strong>. Private key encrypted with your password and <strong className="text-zinc-400">never sent in plaintext</strong>.</span>
      </div>

      <button type="submit" disabled={loading || !username.trim() || password.length < 8}
        className="w-full relative overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: loading ? '#059669' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: loading ? 'none' : '0 4px 24px rgba(16,185,129,0.25)' }}>
        {loading ? (
          <span className="flex items-center justify-center gap-2.5">
            <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            {STEP_LABELS[step]}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Create secure vault
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        )}
      </button>
    </form>
  );
}