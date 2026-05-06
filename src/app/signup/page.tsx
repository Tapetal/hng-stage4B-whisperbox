import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex overflow-hidden bg-[#0a0a0b]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(160deg, #0d1f18 0%, #0a0a0b 60%)' }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
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

        {/* Feature list */}
        <div className="relative z-10 space-y-6">
          {[
            { icon: '🔑', title: 'Zero-knowledge', desc: 'Your private key is generated locally and never sent to our servers unencrypted.' },
            { icon: '🔒', title: 'RSA-2048 + AES-GCM', desc: 'Military-grade hybrid encryption for every message and file.' },
            { icon: '💨', title: 'Real-time delivery', desc: 'WebSocket-powered messaging with automatic reconnection.' },
          ].map(f => (
            <div key={f.title} className="flex gap-4">
              <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <p className="text-sm font-bold text-zinc-200">{f.title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-zinc-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 online-dot" />
          All messages encrypted with RSA-OAEP + AES-GCM
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 0 24px rgba(16,185,129,0.3)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-xl font-black text-white">WhisperBox</h1>
          </div>

          <h2 className="text-2xl font-black text-white mb-1">Create your vault</h2>
          <p className="text-sm text-zinc-500 mb-8">Your keys are generated on this device — never on our servers.</p>

          <SignupForm />

          <p className="text-center text-sm text-zinc-600 mt-8">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}