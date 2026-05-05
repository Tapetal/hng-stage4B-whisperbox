'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import {
  unwrapPrivateKey,
  storeWrappedKeyPair,
  importPublicKey, // 👈 use this instead of manual atob
} from '@/lib/crypto/keys';
import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Welcome Back</h1>
        <p className="text-zinc-500 text-sm mt-1">Access your secure vault.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          <label
            htmlFor="login-username"
            className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1"
          >
            Identity
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/5 rounded-2xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-700 focus:ring-2 focus:ring-brand-500/40 focus:outline-none transition-all shadow-inner"
            placeholder="Enter username"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1"
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
            className="w-full bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/5 rounded-2xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-700 focus:ring-2 focus:ring-brand-500/40 focus:outline-none transition-all shadow-inner"
            placeholder="••••••••"
          />
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
              <span>Unlocking Vault...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}