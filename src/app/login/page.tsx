import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex overflow-hidden bg-[#0a0a0b]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(160deg, #0d1f18 0%, #0a0a0b 60%)' }}>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Glow orb */}
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 0 24px rgba(16,185,129,0.35)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <span className="text-lg font-black text-white tracking-tight">WhisperBox</span>
          </div>
        </div>

        <div className="relative z-10">
          <blockquote className="text-3xl font-black text-white leading-tight tracking-tight mb-6">
            "Your messages.<br/>
            <span className="text-gradient">Nobody else's.</span>"
          </blockquote>
          <p className="text-sm text-zinc-500 leading-relaxed">
            End-to-end encrypted. Zero knowledge. Your private key never leaves this device.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-zinc-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 online-dot" />
          All messages encrypted with RSA-OAEP + AES-GCM
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 0 24px rgba(16,185,129,0.3)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-xl font-black text-white">WhisperBox</h1>
            <p className="text-xs text-zinc-500 mt-1">End-to-end encrypted messaging</p>
          </div>

          <h2 className="text-2xl font-black text-white mb-1">Welcome back</h2>
          <p className="text-sm text-zinc-500 mb-8">Sign in to your encrypted vault.</p>

          <LoginForm />

          <p className="text-center text-sm text-zinc-600 mt-8">
            New to WhisperBox?{' '}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}