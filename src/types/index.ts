// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  publicKey: string;   // Base64-encoded SPKI public key
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Session {
  token: string;
  user: User;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export interface EncryptedMessage {
  id: string;
  senderId: string;
  recipientId: string;
  /** AES-GCM ciphertext (base64) */
  ciphertext: string;
  /** Encrypted AES key for recipient (base64, RSA-OAEP wrapped) */
  encryptedKey: string;
  /** AES-GCM IV (base64) */
  iv: string;
  /** Encrypted AES key for sender (so sender can re-read their own messages) */
  senderEncryptedKey: string;
  createdAt: string;
}

export interface DecryptedMessage extends EncryptedMessage {
  plaintext: string;
  decryptionFailed?: boolean;
}

export interface SendMessagePayload {
  recipientId: string;
  ciphertext: string;
  encryptedKey: string;
  iv: string;
  senderEncryptedKey: string;
}

// ── UI ────────────────────────────────────────────────────────────────────────
export interface Contact extends User {
  lastSeen?: string;
}
