/**
 * Hybrid encryption:
 *  1. Generate ephemeral AES-GCM-256 key
 *  2. Encrypt plaintext with AES-GCM
 *  3. Wrap AES key with recipient's RSA-OAEP public key
 *  4. Also wrap AES key with sender's own public key (so sender can re-read)
 *
 * Decryption:
 *  1. Unwrap AES key using your RSA private key
 *  2. Decrypt ciphertext with AES-GCM
 */

import { importPublicKey } from './keys';

// ── Helpers ───────────────────────────────────────────────────────────────────
function u8ToB64(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join(''));
}

function b64ToU8(b64: string): Uint8Array {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Encrypt ───────────────────────────────────────────────────────────────────
export interface EncryptResult {
  ciphertext:         string;  // base64 AES-GCM ciphertext
  iv:                 string;  // base64 IV
  encryptedKey:       string;  // base64 AES key wrapped with recipient pubkey
  senderEncryptedKey: string;  // base64 AES key wrapped with sender pubkey
}

export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderPublicKeyB64: string,
): Promise<EncryptResult> {
  // 1. Generate ephemeral AES-GCM-256 key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

  // 2. Generate random IV (96 bits)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt plaintext
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    aesKey,
    enc.encode(plaintext),
  );

  // 4. Export raw AES key
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);

  // 5. Wrap for recipient
  const recipientPubKey = await importPublicKey(recipientPublicKeyB64);
  const wrappedForRecipient = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPubKey,
    rawAes,
  );

  // 6. Wrap for sender (so sender can re-read own messages)
  const senderPubKey = await importPublicKey(senderPublicKeyB64);
  const wrappedForSender = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    senderPubKey,
    rawAes,
  );

  return {
    ciphertext:         u8ToB64(cipherBuf),
    iv:                 u8ToB64(iv.buffer as ArrayBuffer),
    encryptedKey:       u8ToB64(wrappedForRecipient),
    senderEncryptedKey: u8ToB64(wrappedForSender),
  };
}

// ── Decrypt ───────────────────────────────────────────────────────────────────
export async function decryptMessage(
  ciphertextB64: string,
  ivB64: string,
  wrappedKeyB64: string,       // the key encrypted with THIS user's public key
  privateKey: CryptoKey,
): Promise<string> {
  // 1. Unwrap AES key using RSA-OAEP private key
  const wrappedKey = b64ToU8(wrappedKeyB64);
  const rawAes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    wrappedKey.buffer as ArrayBuffer,
  );

  // 2. Re-import as AES-GCM key
  const aesKey = await crypto.subtle.importKey(
    'raw', rawAes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // 3. Decrypt ciphertext
  const iv = b64ToU8(ivB64);
  const cipher = b64ToU8(ciphertextB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    aesKey,
    cipher.buffer as ArrayBuffer,
  );

  return dec.decode(plainBuf);
}
