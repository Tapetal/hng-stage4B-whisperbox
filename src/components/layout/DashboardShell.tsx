'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadSession, clearSession } from '@/lib/store/session';
import { conversationsApi, usersApi } from '@/lib/api/client';
import { getToken, getUser } from '@/lib/store/session';
import ContactList from '@/components/chat/ContactList';
import ChatWindow from '@/components/chat/ChatWindow';
import type { User } from '@/types';

export default function DashboardShell() {
  const router = useRouter();
  const [activeContact, setActiveContact] = useState<User | null>(null);
  const [contacts, setContacts]           = useState<User[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [sidebarOpen, setSidebarOpen]     = useState(false);

  const me = getUser();

  // Auth guard
  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace('/login');
  }, [router]);

  // Load existing conversations as contacts
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    conversationsApi.getAll(token)
      .then(users => setContacts(users))
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  useEffect(() => {
    const token = getToken();
    const query = searchQuery.trim();
    if (!token || query.length < 2) return;

    const id = setTimeout(() => {
      setLoadingContacts(true);
      usersApi.search(query, token)
        .then(users => {
          if (me) setContacts(users.filter(u => u.id !== me.id));
        })
        .catch(() => {})
        .finally(() => setLoadingContacts(false));
    }, 250);

    return () => clearTimeout(id);
  }, [searchQuery, me]);

  function handleLogout() {
    clearSession();
    router.replace('/login');
  }

  const filtered = contacts.filter(c =>
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.displayName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!me) return null;

  return (
    <div className="h-screen flex overflow-hidden bg-[#0f0f10]">
      {/* Sidebar */}
      <aside className={`
        flex flex-col w-72 bg-[#1a1a1c] border-r border-[#2e2e32] flex-shrink-0
        absolute inset-y-0 left-0 z-20 transition-transform md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#2e2e32]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {me.username[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">{me.displayName || me.username}</p>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />
                Online
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-[#222225]"
            aria-label="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search people…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#222225] border border-[#2e2e32] rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors"
              aria-label="Search contacts"
            />
          </div>
        </div>

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pb-1">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-1 mb-1">
              People
            </p>
          </div>
          <ContactList
            contacts={filtered}
            activeId={activeContact?.id ?? null}
            loading={loadingContacts}
            onSelect={c => { setActiveContact(c); setSidebarOpen(false); }}
          />
        </div>

        {/* E2EE badge */}
        <div className="px-4 py-3 border-t border-[#2e2e32]">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="text-brand-500">🔒</span>
            End-to-end encrypted
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[#2e2e32] bg-[#1a1a1c]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-zinc-400 hover:text-zinc-200 p-1"
            aria-label="Open contacts"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-zinc-100">
            {activeContact ? activeContact.username : 'WhisperBox'}
          </span>
        </div>

        {activeContact ? (
          <ChatWindow
            key={activeContact.id}
            contact={activeContact}
            me={me}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">WhisperBox</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              Select a contact to start a conversation. All messages are encrypted end-to-end.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-600 bg-[#1a1a1c] rounded-lg px-4 py-2.5 border border-[#2e2e32]">
              <span className="text-brand-500">🔑</span>
              Your private key is stored only on this device
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
