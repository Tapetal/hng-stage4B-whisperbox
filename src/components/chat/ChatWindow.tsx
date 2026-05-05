'use client';

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { useChat } from '@/hooks/useChat';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type { DecryptedMessage, EncryptedMessage, User } from '@/types';

interface Props {
  contact: User;
  me: User;
  incomingMessage?: EncryptedMessage | null;
  isContactOnline?: boolean;
  onBack?: () => void;
}

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

const POLL_MS = 5000;

export default function ChatWindow({ contact, me, incomingMessage, isContactOnline = false, onBack }: Props) {
  const { messages, loading, sending, error, sendMessage, sendFile, reload } = useChat(contact, incomingMessage);

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || sending) return;

    await sendFile(file);
    e.target.value = '';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const contactName = contact.displayName || contact.username;
  const initials = contactName.slice(0, 2).toUpperCase();
  const presenceLabel = isContactOnline ? 'Online' : 'Offline';

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0f0f10] transition-colors">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-md sticky top-0 z-20 flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
          aria-label="Back to conversations"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/20">
            {contact.displayName?.[0] || contact.username[0].toUpperCase()}
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#1a1a1c] rounded-full ${isContactOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`}
            title={presenceLabel}
            aria-label={presenceLabel}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-tight">{contactName}</h3>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isContactOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`}
              title={presenceLabel}
              aria-label={presenceLabel}
            />
            <span className="opacity-80">{presenceLabel}</span>
          </div>
        </div>

        <button
          onClick={reload}
          className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#222225] transition-colors"
          aria-label="Refresh messages"
          title="Refresh"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-hide">
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-400 dark:text-zinc-600 text-sm flex items-center gap-2">
              <span className="animate-spin text-lg">⚙️</span> Loading messages…
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-[2.5rem] bg-brand-600/5 border border-brand-500/10 dark:border-brand-500/20 flex items-center justify-center text-4xl mb-6 shadow-2xl shadow-brand-500/5"
            >
              🔒
            </motion.div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">No messages yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
              Messages are encrypted end-to-end — only you and {contactName} can read them.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={msg.senderId === me.id}
              showAvatar={msg.senderId !== me.id && (i === 0 || messages[i - 1].senderId !== msg.senderId)}
              contactInitials={initials}
            />
          ))}
        </AnimatePresence>

        {error && (
          <div role="alert" className="text-xs text-red-400 bg-red-950/30 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <footer className="p-4 md:p-6 bg-gradient-to-t from-zinc-50 dark:from-[#0f0f10] via-zinc-50 dark:via-[#0f0f10] to-transparent">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white dark:bg-[#1a1a1c] hover:bg-zinc-100 dark:hover:bg-[#222225] disabled:opacity-40 border border-zinc-200 dark:border-white/5 flex items-center justify-center transition-all shadow-sm dark:shadow-lg text-zinc-500 dark:text-zinc-300"
            aria-label="Attach file"
            title="Attach file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </motion.button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Type a secure message to ${contactName}...`}
              rows={1}
              disabled={sending}
              className="w-full bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/5 rounded-2xl px-5 py-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all resize-none max-h-32 overflow-y-auto leading-relaxed disabled:opacity-60 shadow-sm dark:shadow-2xl"
              style={{ minHeight: '48px' }}
              aria-label="Message input"
            />
          </div>

          <motion.button
            type="submit"
            disabled={!draft.trim() || sending}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 w-12 h-12 rounded-2xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-brand-600/20"
            aria-label="Send message"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="translate-x-0.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </motion.button>
        </form>
      </footer>
    </div>
  );
}

function MessageBubble({
  msg,
  isMine,
  showAvatar,
  contactInitials,
}: {
  msg: DecryptedMessage;
  isMine: boolean;
  showAvatar: boolean;
  contactInitials: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex items-end gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isMine && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-violet-500/10">
            {contactInitials}
          </div>
        )}
      </div>

      <div className={`max-w-[85%] md:max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`
            rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm
            ${isMine
              ? 'bg-brand-600 text-white rounded-br-none'
              : 'bg-white dark:bg-[#222225] text-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200 dark:border-white/5'}
            ${msg.decryptionFailed ? 'border-red-500/50 bg-red-500/10' : ''}
          `}
        >
          {msg.decryptionFailed ? (
            <span className="text-xs flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <span className="text-sm">⚠️</span> Decryption error
            </span>
          ) : msg.type === 'file' ? (
            <FileMessage msg={msg} />
          ) : (
            msg.plaintext
          )}
        </div>

        <div className={`flex items-center gap-1.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600">{formatMsgTime(msg.createdAt)}</span>
          {isMine && <span title="Encrypted" className="text-[10px] text-brand-600">🔒</span>}
        </div>
      </div>
    </motion.div>
  );
}

function FileMessage({ msg }: { msg: DecryptedMessage }) {
  const isImage = msg.mimeType?.startsWith('image/');

  if (isImage && msg.fileUrl) {
    return (
      <a href={msg.fileUrl} download={msg.fileName} className="block">
        <img
          src={msg.fileUrl}
          alt={msg.fileName || 'Encrypted image'}
          className="max-w-[240px] md:max-w-xs rounded-xl border border-zinc-200 dark:border-white/10"
        />
        <p className="mt-2 text-xs opacity-80 truncate">{msg.fileName}</p>
      </a>
    );
  }

  return (
    <a
      href={msg.fileUrl}
      download={msg.fileName}
      className="flex items-center gap-3 min-w-[180px] max-w-[260px]"
    >
      <span className="text-2xl">📄</span>
      <span className="text-xs font-medium truncate">{msg.fileName || 'Encrypted file'}</span>
    </a>
  );
}
