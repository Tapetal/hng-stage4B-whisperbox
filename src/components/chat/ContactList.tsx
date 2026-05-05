'use client';

import type { User } from '@/types';

interface Props {
  contacts: User[];
  activeId: string | null;
  loading: boolean;
  onSelect: (user: User) => void;
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const COLORS = [
  'bg-violet-600', 'bg-blue-600', 'bg-cyan-600',
  'bg-teal-600',   'bg-orange-600', 'bg-rose-600',
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

export default function ContactList({ contacts, activeId, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="px-3 space-y-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl animate-pulse">
            <div className="w-9 h-9 rounded-full bg-[#2e2e32] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#2e2e32] rounded w-3/4" />
              <div className="h-2.5 bg-[#2e2e32] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-zinc-600">
        No contacts found.
      </div>
    );
  }

  return (
    <ul className="px-3 space-y-0.5" role="list" aria-label="Contacts">
      {contacts.map(contact => (
        <li key={contact.id}>
          <ContactButton
            contact={contact}
            activeId={activeId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

function ContactButton({
  contact,
  activeId,
  onSelect,
}: {
  contact: User;
  activeId: string | null;
  onSelect: (user: User) => void;
}) {
  const name = contact.displayName || contact.username;

  return (
    <button
      onClick={() => onSelect(contact)}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors
        ${activeId === contact.id
          ? 'bg-brand-600/15 text-zinc-100'
          : 'hover:bg-[#222225] text-zinc-300 hover:text-zinc-100'
        }
      `}
      aria-pressed={activeId === contact.id}
      aria-label={`Chat with ${name}`}
    >
      <div className={`w-9 h-9 rounded-full ${avatarColor(contact.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-zinc-500 truncate">@{contact.username}</p>
      </div>
      {activeId === contact.id && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
      )}
    </button>
  );
}
