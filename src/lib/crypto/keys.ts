/**
 * Key management using Web Crypto API.
 * Private keys NEVER leave the device — stored in IndexedDB via idb.
 * Public keys are uploaded to the server as Base64 SPKI.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME    = 'whisperbox-keys';
const DB_VERSION = 1;
const STORE      = 'keypairs';
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

// ── Generate RSA-OAEP key pair ─────────────────────────────────────────────────
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,   // extractable so the private key can be wrapped before upload
    ['encrypt', 'decrypt'],
  );
}

function u8ToB64(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join(''));
}

function b64ToU8(b64: string): Uint8Array {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}

// ── Export public key as Base64 SPKI ──────────────────────────────────────────
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return u8ToB64(spki);
}

// ── Import public key from Base64 SPKI ───────────────────────────────────────
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const u8 = b64ToU8(b64);
  return crypto.subtle.importKey(
    'spki',
    u8.buffer as ArrayBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

async function deriveWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function wrapPrivateKey(privateKey: CryptoKey, password: string): Promise<{
  wrappedPrivateKey: string;
  pbkdf2Salt: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(password, salt);
  const wrapped = await crypto.subtle.wrapKey('jwk', privateKey, wrappingKey, 'AES-KW');

  return {
    wrappedPrivateKey: u8ToB64(wrapped),
    pbkdf2Salt: u8ToB64(salt.buffer as ArrayBuffer),
  };
}

export async function unwrapPrivateKey(
  wrappedPrivateKeyB64: string,
  pbkdf2SaltB64: string,
  password: string,
): Promise<CryptoKey> {
  const salt = b64ToU8(pbkdf2SaltB64);
  const wrappingKey = await deriveWrappingKey(password, salt);

  return crypto.subtle.unwrapKey(
    'jwk',
    b64ToU8(wrappedPrivateKeyB64).buffer as ArrayBuffer,
    wrappingKey,
    'AES-KW',
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
}

// ── Store encrypted key material in IndexedDB; keep unwrapped key in memory ──
export async function storeWrappedKeyPair(
  userId: string,
  publicKey: CryptoKey,
  privateKey: CryptoKey,
  wrappedPrivateKey: string,
  pbkdf2Salt: string,
): Promise<void> {
  const db = await getDB();
  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);
  await db.put(STORE, { userId, publicJwk, wrappedPrivateKey, pbkdf2Salt });
  unlockedKeys.set(userId, { publicKey, privateKey });
}

export function unlockKeyPair(userId: string, keyPair: CryptoKeyPair): void {
  unlockedKeys.set(userId, keyPair);
}

// ── Load key pair from IndexedDB ──────────────────────────────────────────────
export async function loadKeyPair(userId: string): Promise<CryptoKeyPair | null> {
  const unlocked = unlockedKeys.get(userId);
  if (unlocked) return unlocked;

  const db = await getDB();
  const record = await db.get(STORE, userId);
  if (!record) return null;
  if (!record.privateJwk) return null;

  const publicKey = await crypto.subtle.importKey(
    'jwk', record.publicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true, ['encrypt'],
  );
  const privateKey = await crypto.subtle.importKey(
    'jwk', record.privateJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true, ['decrypt'],
  );
  return { publicKey, privateKey };
}

// ── Delete key pair (on logout) ───────────────────────────────────────────────
export async function deleteKeyPair(userId: string): Promise<void> {
  const db = await getDB();
  unlockedKeys.delete(userId);
  await db.delete(STORE, userId);
}

// ── Check if key pair exists ───────────────────────────────────────────────────
export async function hasKeyPair(userId: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORE, userId);
  return !!record;
}
