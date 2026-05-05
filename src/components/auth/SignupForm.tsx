'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { generateKeyPair, exportPublicKey, storeWrappedKeyPair, wrapPrivateKey } from '@/lib/crypto/keys';
import { saveSession } from '@/lib/store/session';

export default function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState<'form' | 'keys'>('form');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError(null);
    setLoading(true);
    setStep('keys');

    try {
      // 1. Generate key pair BEFORE registering
      const keyPair = await generateKeyPair();
      const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
      const { wrappedPrivateKey, pbkdf2Salt } = await wrapPrivateKey(keyPair.privateKey, password);

      // 2. Register — public key and encrypted private key backup go to server
      const { accessToken, refreshToken, user } = await authApi.signup({
        username: username.trim(),
        displayName: displayName.trim() || username.trim(),
        password,
        publicKey: publicKeyB64,
        wrappedPrivateKey,
        pbkdf2Salt,
      });

      // 3. Store only encrypted key material durably; keep private key unlocked in memory
      await storeWrappedKeyPair(user.id, keyPair.publicKey, keyPair.privateKey, wrappedPrivateKey, pbkdf2Salt);

      // 4. Create session
      saveSession({ accessToken, refreshToken, user });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {step === 'keys' && loading && (
        <div className="text-sm text-brand-400 bg-brand-950/20 border border-brand-900/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <span className="animate-spin text-base">⚙️</span>
          Generating your encryption keys…
        </div>
      )}

      {error && (
        <div role="alert" className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="signup-username" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          Username
        </label>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
          placeholder="alice"
        />
      </div>

      <div>
        <label htmlFor="signup-display-name" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          Display name
        </label>
        <input
          id="signup-display-name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
          placeholder="Alice"
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
          placeholder="8+ characters"
        />
      </div>

      <div className="flex items-start gap-2 text-xs text-zinc-500 bg-[#222225] rounded-lg p-3">
        <span className="text-brand-400 mt-0.5 flex-shrink-0">🔑</span>
        <span>An RSA-2048 key pair will be generated on your device. Your private key is wrapped with your password before backup.</span>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1c]"
      >
        {loading ? 'Setting up…' : 'Create account'}
      </button>
    </form>
  );
}
