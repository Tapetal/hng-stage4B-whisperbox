// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  displayName?: string;
  publicKey?: string;   // Base64-encoded SPKI public key
  wrappedPrivateKey?: string;
  pbkdf2Salt?: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export interface EncryptedMessage {
  id: string;
  senderId: string;
  recipientId: string;

  type?: MessageType;
  /** AES-GCM ciphertext (base64) */
  ciphertext: string;
  /** Encrypted AES key for recipient (base64, RSA-OAEP wrapped) */
  encryptedKey: string;
  /** AES-GCM IV (base64) */
  iv: string;
  /** Encrypted AES key for sender (so sender can re-read their own messages) */
  senderEncryptedKey: string;

  fileName?: string;
  mimeType?: string;
  delivered?: boolean;
  read?: boolean;
  status?: MessageStatus;

  createdAt: string;
}

export interface DecryptedMessage extends EncryptedMessage {
  plaintext?: string;
  fileUrl?: string; 
  decryptionFailed?: boolean;
}

export interface SendMessagePayload {
  to: string;
  payload: {
    ciphertext: string;
    encryptedKey: string;
    iv: string;
    encryptedKeyForSelf: string;
  };
}

// ── UI ────────────────────────────────────────────────────────────────────────
export interface Contact extends User {
  lastSeen?: string;
}

export type MessageType = 'text' | 'file';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
