'use client';

import { useState, useEffect, useCallback } from 'react';
import { messagesApi, usersApi } from '@/lib/api/client';
import { encryptMessage, decryptMessage } from '@/lib/crypto/encryption';
import { loadKeyPair } from '@/lib/crypto/keys';
import { getToken, getUser } from '@/lib/store/session';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToUint8Array(base64: string) {
  const bin = atob(base64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function inferMimeType(fileName?: string, mimeType?: string) {
  if (mimeType) return mimeType;

  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';

  const known: Record<string, string> = {
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
  };

  return known[ext] ?? 'application/octet-stream';
}

function sortMessages(messages: any[]) {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function upsertMessage(messages: any[], message: any) {
  const next = messages.some(m => m.id === message.id)
    ? messages.map(m => (m.id === message.id ? { ...m, ...message } : m))
    : [...messages, message];

  return sortMessages(next);
}

export function useChat(contact: any, incomingMessage?: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = getUser();

  // 🔐 decrypt message
  const decryptMsg = useCallback(async (msg: any) => {
  if (!me) {
    return {
      ...msg,
      plaintext: '',
      decryptionFailed: true,
    };
  }

  try {
    const keyPair = await loadKeyPair(me.id);

    if (!keyPair) {
      return {
        ...msg,
        plaintext: '',
        decryptionFailed: true,
      };
    }

    const wrappedKey =
      msg.senderId === me.id
        ? msg.senderEncryptedKey
        : msg.encryptedKey;

    const plaintext = await decryptMessage(
      msg.ciphertext,
      msg.iv,
      wrappedKey,
      keyPair.privateKey
    );

    try {
      const parsed = JSON.parse(plaintext);

      if (parsed.type === 'file') {
        const bytes = base64ToUint8Array(parsed.data);
        const mimeType = inferMimeType(parsed.fileName, parsed.mimeType);
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        return {
          ...msg,
          type: 'file',
          fileName: parsed.fileName,
          mimeType,
          fileUrl: url,
          decryptionFailed: false,
        };
      }
    } catch {}

    return {
      ...msg,
      type: 'text',
      plaintext,
      decryptionFailed: false,
    };

  } catch {
    return {
      ...msg,
      plaintext: 'Decryption failed',
      decryptionFailed: true,
    };
  }
}, [me]);

  // 📥 load messages
  const loadMessages = useCallback(async () => {
    if (!contact || !me) return;

    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const encrypted = await messagesApi.getConversation(contact.id, token);

      const decrypted = await Promise.all(
        encrypted.map((m: any) => decryptMsg(m))
      );

      setMessages(sortMessages(decrypted));
    } catch (e: any) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [contact, me, decryptMsg]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!incomingMessage || !contact || !me) return;

    const belongsToConversation =
      incomingMessage.senderId === contact.id ||
      incomingMessage.recipientId === contact.id;

    if (!belongsToConversation) return;

    decryptMsg(incomingMessage).then(decrypted => {
      setMessages(prev => upsertMessage(prev, decrypted));
    });
  }, [contact, decryptMsg, incomingMessage, me]);

  // ✉️ send text
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (!contact?.id || !me?.id) {
      setError('Missing encryption key');
      return;
    }

    const token = getToken();
    if (!token) return;

    setSending(true);
    setError(null);
    const tempId = `local-${Date.now()}`;

    try {
      const recipientPublicKey = contact.publicKey || await usersApi.getPublicKey(contact.id, token);
      const senderPublicKey = me.publicKey || await usersApi.getPublicKey(me.id, token);

      const encrypted = await encryptMessage(
        text,
        recipientPublicKey,
        senderPublicKey
      );

      setMessages(prev => upsertMessage(prev, {
        id: tempId,
        senderId: me.id,
        recipientId: contact.id,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        encryptedKey: encrypted.encryptedKey,
        senderEncryptedKey: encrypted.senderEncryptedKey,
        createdAt: new Date().toISOString(),
        type: 'text',
        plaintext: text,
        status: 'sending',
      }));

      const sent = await messagesApi.send(
        {
          to: contact.id,
          payload: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            encryptedKey: encrypted.encryptedKey,
            encryptedKeyForSelf: encrypted.senderEncryptedKey,
          },
        },
        token
      );

      setMessages(prev => sortMessages(
        prev
          .filter(msg => msg.id !== tempId)
          .concat({
            ...sent,
            type: 'text',
            plaintext: text,
            status: sent.read ? 'read' : sent.delivered ? 'delivered' : 'sent',
          })
      ));
    } catch (e: any) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setError(e.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [contact, me]);

  // 📎 send file
  const sendFile = useCallback(async (file: File) => {
    if (!contact?.id || !me?.id) {
      setError('Missing encryption key');
      return;
    }

    const token = getToken();
    if (!token) return;

    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 5MB)');
      return;
    }

    setSending(true);
    setError(null);
    const tempId = `local-file-${Date.now()}`;

    try {
      const buffer = await file.arrayBuffer();
      const fileUrl = URL.createObjectURL(file);
      const mimeType = inferMimeType(file.name, file.type);

      const payload = JSON.stringify({
        type: 'file',
        fileName: file.name,
        mimeType,
        data: arrayBufferToBase64(buffer),
      });

      const recipientPublicKey = contact.publicKey || await usersApi.getPublicKey(contact.id, token);
      const senderPublicKey = me.publicKey || await usersApi.getPublicKey(me.id, token);

      const encrypted = await encryptMessage(
        payload,
        recipientPublicKey,
        senderPublicKey
      );

      setMessages(prev => upsertMessage(prev, {
        id: tempId,
        senderId: me.id,
        recipientId: contact.id,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        encryptedKey: encrypted.encryptedKey,
        senderEncryptedKey: encrypted.senderEncryptedKey,
        createdAt: new Date().toISOString(),
        type: 'file',
        fileName: file.name,
        mimeType,
        fileUrl,
        status: 'sending',
      }));

      const sent = await messagesApi.send(
        {
          to: contact.id,
          payload: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            encryptedKey: encrypted.encryptedKey,
            encryptedKeyForSelf: encrypted.senderEncryptedKey,
          },
        },
        token
      );

      setMessages(prev => sortMessages(
        prev
          .filter(msg => msg.id !== tempId)
          .concat({
          ...sent,
          type: 'file',
          fileName: file.name,
          mimeType,
          fileUrl,
          status: sent.read ? 'read' : sent.delivered ? 'delivered' : 'sent',
        })
      ));
    } catch (e: any) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setError(e.message || 'Failed to send file');
    } finally {
      setSending(false);
    }
  }, [contact, me]);

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    sendFile,
    reload: loadMessages,
  };
}
