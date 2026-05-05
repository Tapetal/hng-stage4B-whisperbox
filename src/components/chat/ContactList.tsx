'use client';

import type { User } from '@/types';
import { motion } from 'framer-motion';

interface Props {
  contacts: User[];
  activeId: string | null;
  onlineUserIds: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  loading: boolean;
  onSelect: (user: User) => void;
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const COLORS = [
  'from-violet-600 to-indigo-600', 'from-blue-600 to-cyan-600', 'from-cyan-600 to-teal-600',
  'from-teal-600 to-emerald-600', 'from-orange-600 to-amber-600', 'from-rose-600 to-pink-600',
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

export default function ContactList({ contacts, activeId, onlineUserIds, unreadCounts, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="px-3 space-y-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl animate-pulse">
            <div className="w-11 h-11 rounded-xl bg-zinc-200 dark:bg-[#2e2e32] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-zinc-200 dark:bg-[#2e2e32] rounded w-3/4" />
              <div className="h-2.5 bg-[#2e2e32] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-600">
        No contacts found.
      </div>
    );
  }

  return (
    <ul className="px-3 space-y-0.5" role="list" aria-label="Contacts">
      {contacts.map(contact => (
        <motion.li key={contact.id} layout>
          <ContactButton
            contact={contact}
            activeId={activeId}
            isOnline={onlineUserIds[contact.id] ?? false}
            unreadCount={unreadCounts[contact.id] ?? 0}
            onSelect={onSelect}
          />
        </motion.li>
      ))}
    </ul>
  );
}

function ContactButton({
  contact,
  activeId,
  isOnline,
  unreadCount,
  onSelect,
}: {
  contact: User;
  activeId: string | null;
  isOnline: boolean;
  unreadCount: number;
  onSelect: (user: User) => void;
}) {
  const name = contact.displayName || contact.username;
  const presenceLabel = isOnline ? 'Online' : 'Offline';

  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(contact)}
      className={`
        w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all border
        ${activeId === contact.id
          ? 'bg-brand-600/10 border-brand-500/30 text-zinc-900 dark:text-zinc-100 shadow-lg shadow-brand-900/5'
          : 'hover:bg-zinc-100 dark:hover:bg-[#222225] border-transparent text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'
        }
      `}
      aria-pressed={activeId === contact.id}
      aria-label={`Chat with ${name}`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor(contact.id)} flex items-center justify-center text-white text-sm font-bold shadow-inner`}>
          {getInitials(name)}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1a1c] ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`}
          title={presenceLabel}
          aria-label={presenceLabel}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate leading-tight mb-0.5">{name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 truncate">@{contact.username}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        {unreadCount > 0 ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-600/20"
            aria-label={`${unreadCount} unread messages`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        ) : activeId === contact.id && (
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(var(--brand-500),0.8)]" />
        )}
      </div>
    </motion.button>
  );
}
