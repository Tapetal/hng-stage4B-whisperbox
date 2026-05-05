'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { generateKeyPair, exportPublicKey, storeWrappedKeyPair, wrapPrivateKey } from '@/lib/crypto/keys';
import { motion, AnimatePresence } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-600/10 border border-brand-500/20 shadow-2xl mb-4">
          <span className="text-3xl">✨</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Create Account</h1>
        <p className="text-zinc-500 text-sm mt-1">Join the future of private messaging.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AnimatePresence mode="wait">
          {step === 'keys' && loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-xs font-bold uppercase tracking-widest text-brand-400 bg-brand-950/20 border border-brand-900/30 rounded-2xl px-4 py-4 flex items-center justify-center gap-3 shadow-2xl shadow-brand-500/5"
            >
              <span className="animate-spin text-lg">⚙️</span>
              Generating secure key pair...
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="alert"
            className="text-xs font-bold uppercase tracking-wide text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3 text-center"
          >
            {error}
          </motion.div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="signup-username" className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-[#1a1a1c] border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-700 focus:ring-2 focus:ring-brand-500/40 focus:outline-none transition-all shadow-inner"
            placeholder="e.g. alice_wonder"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-display-name" className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">
            Display Name
          </label>
          <input
            id="signup-display-name"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-[#1a1a1c] border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-700 focus:ring-2 focus:ring-brand-500/40 focus:outline-none transition-all shadow-inner"
            placeholder="Your public name"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">
            Passphrase
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#1a1a1c] border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-700 focus:ring-2 focus:ring-brand-500/40 focus:outline-none transition-all shadow-inner"
            placeholder="Min. 8 characters"
          />
        </div>

        <div className="flex items-start gap-3 text-[11px] leading-relaxed text-zinc-500 bg-[#1a1a1c] rounded-2xl p-4 border border-white/5 shadow-inner">
          <span className="text-brand-400 text-lg flex-shrink-0">🔑</span>
          <span>
            WhisperBox generates an <strong className="text-zinc-300">RSA-2048</strong> key pair on your device. 
            Your private key never leaves this browser unencrypted.
          </span>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-600/20 mt-2 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Initializing Vault...</span>
            </>
          ) : (
            <span>Create Secure Vault</span>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
