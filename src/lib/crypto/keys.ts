/**
 * Key management using Web Crypto API.
 * Private keys NEVER leave the device — stored in IndexedDB via idb.
 * Public keys are uploaded to the server as Base64 SPKI.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME    = 'whisperbox-keys';
const DB_VERSION = 1;
const STORE      = 'keypairs';

let _db: IDBPDatabase | null = null;

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
    true,   // extractable — we need to export public key to server
    ['encrypt', 'decrypt'],
  );
}

// ── Export public key as Base64 SPKI ──────────────────────────────────────────
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(Array.from(new Uint8Array(spki)).map(b => String.fromCharCode(b)).join(''));
}

// ── Import public key from Base64 SPKI ───────────────────────────────────────
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    'spki',
    u8.buffer as ArrayBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

// ── Store key pair in IndexedDB (private key as extractable CryptoKey JWK) ───
export async function storeKeyPair(userId: string, keyPair: CryptoKeyPair): Promise<void> {
  const db = await getDB();
  // Export both keys as JWK for durable storage
  const publicJwk  = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  await db.put(STORE, { userId, publicJwk, privateJwk });
}

// ── Load key pair from IndexedDB ──────────────────────────────────────────────
export async function loadKeyPair(userId: string): Promise<CryptoKeyPair | null> {
  const db = await getDB();
  const record = await db.get(STORE, userId);
  if (!record) return null;

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
  await db.delete(STORE, userId);
}

// ── Check if key pair exists ───────────────────────────────────────────────────
export async function hasKeyPair(userId: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORE, userId);
  return !!record;
}
