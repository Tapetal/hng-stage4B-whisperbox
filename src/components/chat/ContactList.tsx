'use client';
import { motion } from 'framer-motion';
import { avatarGradient, getInitials } from '@/lib/avatar';
import type { User } from '@/types';

interface Props {
  contacts: User[];
  activeId: string | null;
  onlineUserIds: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  loading: boolean;
  onSelect: (user: User) => void;
}

export default function ContactList({ contacts, activeId, onlineUserIds, unreadCounts, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="px-2 space-y-0.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl animate-pulse">
            <div className="w-11 h-11 rounded-2xl bg-[#27272a] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[#27272a] rounded-md w-28" />
              <div className="h-2.5 bg-[#27272a] rounded-md w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!contacts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-3xl mb-3">🔍</div>
        <p className="text-sm font-medium text-zinc-500">No contacts found</p>
        <p className="text-xs text-zinc-700 mt-1">Try searching for someone</p>
      </div>
    );
  }

  return (
    <ul className="px-2 space-y-0.5" role="list" aria-label="Contacts">
      {contacts.map((contact, i) => {
        const name     = contact.displayName || contact.username;
        const isOnline = onlineUserIds[contact.id] ?? false;
        const unread   = unreadCounts[contact.id] ?? 0;
        const active   = activeId === contact.id;

        return (
          <motion.li key={contact.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.2 }}>
            <button
              onClick={() => onSelect(contact)}
              aria-pressed={active}
              aria-label={`Chat with ${name}${unread ? `, ${unread} unread` : ''}`}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all duration-150 relative
                ${active
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'border border-transparent hover:bg-[#18181b] hover:border-[#27272a]'
                }
              `}
            >
                {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGradient(contact.id)} flex items-center justify-center text-white text-sm font-black shadow-lg`}>
                  {getInitials(name)}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111113] transition-colors ${isOnline ? 'bg-emerald-500 online-dot' : 'bg-[#3f3f46]'}`}
                  aria-label={isOnline ? 'Online' : 'Offline'} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate leading-tight ${active ? 'text-zinc-100' : 'text-zinc-300'}`}>{name}</p>
                <p className="text-[11px] text-zinc-600 truncate mt-0.5">@{contact.username}</p>
              </div>

              {/* Badge / indicator */}
              {unread > 0 ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/25">
                  {unread > 99 ? '99+' : unread}
                </motion.span>
              ) : active ? (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              ) : null}
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}
