'use client';

import { useState, useEffect, useCallback } from 'react';
import { messagesApi, usersApi } from '@/lib/api/client';
import { encryptMessage, decryptMessage } from '@/lib/crypto/encryption';
import { loadKeyPair } from '@/lib/crypto/keys';
import { getToken, getUser } from '@/lib/store/session';
import type { DecryptedMessage, EncryptedMessage, User } from '@/types';

export function useChat(contact: User | null, incomingMessage?: EncryptedMessage | null) {
  const contactId = contact?.id ?? null;
  const [messages, setMessages]       = useState<DecryptedMessage[]>([]);
  const [loading, setLoading]         = useState(false);
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const me = getUser();

  const decryptEncryptedMessage = useCallback(async (msg: EncryptedMessage): Promise<DecryptedMessage> => {
    if (!me) return { ...msg, plaintext: '', decryptionFailed: true };

    try {
      const keyPair = await loadKeyPair(me.id);
      if (!keyPair) throw new Error('Encryption keys not found.');

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
  }, [me]);

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
        setError('Your private key is locked. Please sign out and sign back in to unlock it.');
        return;
      }

      const decrypted: DecryptedMessage[] = await Promise.all(
        encrypted.map(decryptEncryptedMessage),
      );

      // Sort by createdAt ascending
      decrypted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(decrypted);
    } catch (e: any) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [contactId, decryptEncryptedMessage, me]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!incomingMessage || !contactId || !me) return;

    const belongsToConversation =
      incomingMessage.senderId === contactId ||
      incomingMessage.recipientId === contactId;

    if (!belongsToConversation) return;

    decryptEncryptedMessage(incomingMessage).then(decrypted => {
      setMessages(prev => {
        if (prev.some(msg => msg.id === decrypted.id)) return prev;
        return [...prev, decrypted].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    });
  }, [contactId, decryptEncryptedMessage, incomingMessage, me]);

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
      const recipientPublicKey = contact.publicKey ?? await usersApi.getPublicKey(contactId, token);
      const senderPublicKey = me.publicKey ?? await usersApi.getPublicKey(me.id, token);

      const encrypted = await encryptMessage(
        plaintext.trim(),
        recipientPublicKey,
        senderPublicKey,
      );

      const sent = await messagesApi.send(
        {
          to: contactId,
          payload: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            encryptedKey: encrypted.encryptedKey,
            encryptedKeyForSelf: encrypted.senderEncryptedKey,
          },
        },
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

  return { messages, loading, sending, error, sendMessage, reload: loadMessages };
}
