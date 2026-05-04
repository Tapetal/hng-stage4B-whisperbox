'use client';

import { useState, useEffect, useCallback } from 'react';
import { messagesApi, usersApi } from '@/lib/api/client';
import { encryptMessage, decryptMessage } from '@/lib/crypto/encryption';
import { loadKeyPair } from '@/lib/crypto/keys';
import { getToken, getUser } from '@/lib/store/session';
import type { DecryptedMessage, User } from '@/types';

export function useChat(contactId: string | null) {
  const [messages, setMessages]       = useState<DecryptedMessage[]>([]);
  const [contact, setContact]         = useState<User | null>(null);
  const [loading, setLoading]         = useState(false);
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const me = getUser();

  // Load contact info
  useEffect(() => {
    if (!contactId) return;
    const token = getToken();
    if (!token) return;
    usersApi.getById(contactId, token)
      .then(setContact)
      .catch(e => setError(e.message));
  }, [contactId]);

  // Load + decrypt conversation
  const loadMessages = useCallback(async () => {
    if (!contactId || !me) return;
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const encrypted = await messagesApi.getConversation(contactId, token);
      const keyPair   = await loadKeyPair(me.id);

      if (!keyPair) {
        setError('Your encryption keys were not found. Please sign out and sign back in.');
        return;
      }

      const decrypted: DecryptedMessage[] = await Promise.all(
        encrypted.map(async msg => {
          try {
            // Use correct wrapped key depending on whether we're sender or recipient
            const wrappedKey = msg.senderId === me.id
              ? msg.senderEncryptedKey
              : msg.encryptedKey;

            const plaintext = await decryptMessage(
              msg.ciphertext,
              msg.iv,
              wrappedKey,
              keyPair.privateKey,
            );
            return { ...msg, plaintext, decryptionFailed: false };
          } catch {
            return { ...msg, plaintext: '', decryptionFailed: true };
          }
        }),
      );

      // Sort by createdAt ascending
      decrypted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(decrypted);
    } catch (e: any) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [contactId, me]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Send a message
  const sendMessage = useCallback(async (plaintext: string) => {
    if (!contactId || !contact || !me || !plaintext.trim()) return;
    const token = getToken();
    if (!token) return;

    setSending(true);
    setError(null);
    try {
      const keyPair = await loadKeyPair(me.id);
      if (!keyPair) throw new Error('Encryption keys not found.');

      const encrypted = await encryptMessage(
        plaintext.trim(),
        contact.publicKey,    // recipient's public key
        me.publicKey,         // sender's own public key (to re-read own msgs)
      );

      const sent = await messagesApi.send(
        { recipientId: contactId, ...encrypted },
        token,
      );

      // Optimistically add to local state
      const optimistic: DecryptedMessage = {
        ...sent,
        plaintext: plaintext.trim(),
        decryptionFailed: false,
      };
      setMessages(prev => [...prev, optimistic]);
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [contactId, contact, me]);

  return { messages, contact, loading, sending, error, sendMessage, reload: loadMessages };
}
