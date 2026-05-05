'use client';

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { useChat } from '@/hooks/useChat';
import { format, isToday, isYesterday } from 'date-fns';
import type { User, DecryptedMessage, EncryptedMessage } from '@/types';

interface Props {
  contact: User;
  me: User;
  incomingMessage?: EncryptedMessage | null;
  onBack?: () => void;
}

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

const POLL_MS = 5000; // poll every 5s for new messages

export default function ChatWindow({ contact, me, incomingMessage, onBack }: Props) {
  const { messages, loading, sending, error, sendMessage, reload } = useChat(contact, incomingMessage);
  const [draft, setDraft]         = useState('');
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft('');
    await sendMessage(text);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const contactName = contact.displayName || contact.username;
  const initials = contactName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2e2e32] bg-[#1a1a1c] flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden text-zinc-400 hover:text-zinc-200 p-1 -ml-1 rounded-lg hover:bg-[#222225] transition-colors"
          aria-label="Back to conversations"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">{contactName}</p>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand-500">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            End-to-end encrypted
          </p>
        </div>
        <button
          onClick={reload}
          className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-[#222225] transition-colors"
          aria-label="Refresh messages"
          title="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" aria-label="Messages" aria-live="polite">
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-600 text-sm flex items-center gap-2">
              <span className="animate-spin">⚙️</span> Loading messages…
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-3xl mb-3">🔒</div>
            <p className="text-sm text-zinc-400 font-medium">No messages yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Messages are encrypted end-to-end — only you and {contactName} can read them.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={msg.senderId === me.id}
            showAvatar={msg.senderId !== me.id && (i === 0 || messages[i - 1].senderId !== msg.senderId)}
            contactInitials={initials}
          />
        ))}

        {error && (
          <div role="alert" className="text-xs text-red-400 bg-red-950/30 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 border-t border-[#2e2e32] bg-[#1a1a1c] flex-shrink-0"
      >
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${contactName}…`}
            rows={1}
            disabled={sending}
            className="w-full bg-[#222225] border border-[#2e2e32] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none transition-colors resize-none max-h-32 overflow-y-auto leading-relaxed disabled:opacity-60"
            style={{ minHeight: '40px' }}
            aria-label="Message input"
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1c]"
          aria-label="Send message"
        >
          {sending ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="translate-x-0.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({
  msg, isMine, showAvatar, contactInitials
}: {
  msg: DecryptedMessage;
  isMine: boolean;
  showAvatar: boolean;
  contactInitials: string;
}) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar placeholder (keep layout consistent) */}
      <div className="w-6 flex-shrink-0">
        {showAvatar && !isMine && (
          <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-[9px] font-bold">
            {contactInitials}
          </div>
        )}
      </div>

      <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div
          className={`
            rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words
            ${isMine
              ? 'bg-brand-600 text-white rounded-br-sm'
              : 'bg-[#2e2e32] text-zinc-100 rounded-bl-sm'
            }
            ${msg.decryptionFailed ? 'opacity-50 italic' : ''}
          `}
        >
          {msg.decryptionFailed ? (
            <span className="text-xs flex items-center gap-1 text-zinc-400">
              <span>🔓</span> Unable to decrypt message
            </span>
          ) : (
            msg.plaintext
          )}
        </div>
        <div className={`flex items-center gap-1 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-zinc-600">{formatMsgTime(msg.createdAt)}</span>
          {isMine && (
            <span title="Encrypted" className="text-[10px] text-brand-600">🔒</span>
          )}
        </div>
      </div>
    </div>
  );
}
