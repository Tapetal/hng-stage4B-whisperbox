/**
 * Key management using Web Crypto API.
 * Private keys never leave the client in plaintext.
 * Public key is uploaded as Base64 SPKI.
 * Private key is exported as PKCS8 and encrypted with AES-GCM using a PBKDF2 key.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'whisperbox-keys';
const DB_VERSION = 1;
const STORE = 'keypairs';
const PBKDF2_ITERATIONS = 250_000;

let _db: IDBPDatabase | null = null;
const unlockedKeys = new Map<string, CryptoKeyPair>();

async function getDB() {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'userId' });
      }
    },
  });

  return _db;
}

function cleanBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(spki);
}

export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const publicKeyBytes = base64ToUint8Array(publicKeyB64);

  return crypto.subtle.importKey(
    'spki',
    cleanBuffer(publicKeyBytes),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt'],
  );
}

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: cleanBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string,
): Promise<{
  wrappedPrivateKey: string;
  pbkdf2Salt: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const wrappingKey = await deriveWrappingKey(password, salt);

  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);

  const encryptedPrivateKey = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    wrappingKey,
    pkcs8,
  );

  const combined = new Uint8Array(iv.byteLength + encryptedPrivateKey.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedPrivateKey), iv.byteLength);

  return {
    wrappedPrivateKey: arrayBufferToBase64(cleanBuffer(combined)),
    pbkdf2Salt: arrayBufferToBase64(cleanBuffer(salt)),
  };
}

export async function unwrapPrivateKey(
  wrappedPrivateKeyB64: string,
  pbkdf2SaltB64: string,
  password: string,
): Promise<CryptoKey> {
  const salt = base64ToUint8Array(pbkdf2SaltB64);
  const wrapped = base64ToUint8Array(wrappedPrivateKeyB64);

  const iv = wrapped.slice(0, 12);
  const ciphertext = wrapped.slice(12);

  const wrappingKey = await deriveWrappingKey(password, salt);

  const pkcs8 = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: cleanBuffer(iv),
    },
    wrappingKey,
    cleanBuffer(ciphertext),
  );

  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt'],
  );
}

export async function storeWrappedKeyPair(
  userId: string,
  publicKey: CryptoKey,
  privateKey: CryptoKey,
  wrappedPrivateKey: string,
  pbkdf2Salt: string,
): Promise<void> {
  const db = await getDB();

  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);

  await db.put(STORE, {
    userId,
    publicJwk,
    wrappedPrivateKey,
    pbkdf2Salt,
  });

  unlockedKeys.set(userId, { publicKey, privateKey });
}

export function unlockKeyPair(userId: string, keyPair: CryptoKeyPair): void {
  unlockedKeys.set(userId, keyPair);
}

export async function loadKeyPair(userId: string): Promise<CryptoKeyPair | null> {
  return unlockedKeys.get(userId) || null;
}

export async function deleteKeyPair(userId: string): Promise<void> {
  const db = await getDB();
  unlockedKeys.delete(userId);
  await db.delete(STORE, userId);
}

export async function hasKeyPair(userId: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORE, userId);
  return !!record;
}