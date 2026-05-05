'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadSession, clearSession } from '@/lib/store/session';
import { conversationsApi, usersApi } from '@/lib/api/client';
import { getToken, getUser } from '@/lib/store/session';
import ContactList from '@/components/chat/ContactList';
import ChatWindow from '@/components/chat/ChatWindow';
import type { EncryptedMessage, User } from '@/types';

const WS_BASE = 'wss://whisperbox.koyeb.app/ws';

type LiveMessage = {
  message: EncryptedMessage;
  nonce: number;
};

export default function DashboardShell() {
  const router = useRouter();
  const [activeContact, setActiveContact] = useState<User | null>(null);
  const [contacts, setContacts]           = useState<User[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [unreadCounts, setUnreadCounts]   = useState<Record<string, number>>({});
  const [liveMessage, setLiveMessage]     = useState<LiveMessage | null>(null);

  const me = getUser();
  const activeContactRef = useRef<User | null>(null);

  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);

  // Auth guard
  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace('/login');
  }, [router]);

  const loadConversations = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const users = await conversationsApi.getAll(token);
      setContacts(users);
    } catch {
      // Keep the current list if refresh fails.
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // Load existing conversations as contacts
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const token = getToken();
    const query = searchQuery.trim();
    if (!token) return;

    if (query.length === 0) {
      loadConversations();
      return;
    }

    if (query.length < 2) return;

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
  }, [loadConversations, searchQuery, me]);

  useEffect(() => {
    const token = getToken();
    if (!token || !me) return;
    const accessToken = token;
    const currentUserId = me.id;

    let closed = false;
    let reconnectId: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    function toEncryptedMessage(raw: any): EncryptedMessage | null {
      if (raw?.event !== 'message.receive' || !raw.payload) return null;

      return {
        id: raw.id,
        senderId: raw.from_user_id,
        recipientId: raw.to_user_id,
        ciphertext: raw.payload.ciphertext,
        iv: raw.payload.iv,
        encryptedKey: raw.payload.encryptedKey,
        senderEncryptedKey: raw.payload.encryptedKeyForSelf,
        createdAt: raw.created_at,
      };
    }

    function connect() {
      ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(accessToken)}`);

      ws.onmessage = event => {
        try {
          const incoming = toEncryptedMessage(JSON.parse(event.data));
          if (!incoming) return;

          const conversationUserId = incoming.senderId === currentUserId
            ? incoming.recipientId
            : incoming.senderId;

          loadConversations();

          if (activeContactRef.current?.id === conversationUserId) {
            setUnreadCounts(prev => ({ ...prev, [conversationUserId]: 0 }));
            setLiveMessage({ message: incoming, nonce: Date.now() });
            return;
          }

          setUnreadCounts(prev => ({
            ...prev,
            [conversationUserId]: (prev[conversationUserId] ?? 0) + 1,
          }));
        } catch {
          // Ignore malformed realtime frames.
        }
      };

      ws.onclose = event => {
        if (closed || event.code === 1000) return;
        reconnectId = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectId) clearTimeout(reconnectId);
      ws?.close(1000);
    };
  }, [loadConversations, me]);

  function handleLogout() {
    clearSession();
    router.replace('/login');
  }

  function handleSelectContact(contact: User) {
    setActiveContact(contact);
    setUnreadCounts(prev => ({ ...prev, [contact.id]: 0 }));
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
        flex flex-col w-full md:w-80 bg-[#1a1a1c] border-r border-[#2e2e32] flex-shrink-0
        ${activeContact ? 'hidden md:flex' : 'flex'}
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
            unreadCounts={unreadCounts}
            loading={loadingContacts}
            onSelect={handleSelectContact}
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

      {/* Chat area */}
      <main className={`${activeContact ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {activeContact ? (
          <ChatWindow
            key={activeContact.id}
            contact={activeContact}
            me={me}
            incomingMessage={liveMessage?.message ?? null}
            onBack={() => setActiveContact(null)}
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
