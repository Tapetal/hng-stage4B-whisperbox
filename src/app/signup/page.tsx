import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0f0f10]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">WhisperBox</h1>
          <p className="text-sm text-zinc-400 mt-1">End-to-end encrypted messaging</p>
        </div>

        <div className="bg-[#1a1a1c] border border-[#2e2e32] rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-zinc-100 mb-5">Create account</h2>
          <SignupForm />
        </div>

        <p className="text-center text-sm text-zinc-500 mt-5">
          Have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
