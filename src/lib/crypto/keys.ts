import { openDB } from 'idb';

const DB_NAME = 'whisperbox';
const STORE = 'keys';

let dbPromise: any;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

// 🔐 utils
function u8ToB64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToU8(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// 🔑 generate keypair
export async function generateKeyPair() {
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

// 📤 export public key
export async function exportPublicKey(key: CryptoKey) {
  const spki = await crypto.subtle.exportKey('spki', key);
  return u8ToB64(spki);
}

// 📥 import public key
export async function importPublicKey(b64: string) {
  const bytes = b64ToU8(b64);

  return crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

// 🔐 derive AES key from password
async function deriveKey(password: string, salt: Uint8Array) {
  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer;

  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 250000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// 🔒 wrap private key
export async function wrapPrivateKey(privateKey: CryptoKey, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt);

  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    pkcs8,
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    wrappedPrivateKey: u8ToB64(combined.buffer),
    pbkdf2Salt: u8ToB64(salt.buffer),
  };
}

// 🔓 unwrap private key
export async function unwrapPrivateKey(
  wrappedB64: string,
  saltB64: string,
  password: string,
) {
  const wrapped = b64ToU8(wrappedB64);
  const salt = b64ToU8(saltB64);

  const iv = wrapped.slice(0, 12);
  const data = wrapped.slice(12);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  return crypto.subtle.importKey(
    'pkcs8',
    decrypted,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
}

// 💾 store keys
export async function storeWrappedKeyPair(
  userId: string,
  publicKey: CryptoKey,
  privateKey: CryptoKey,
  wrappedPrivateKey: string,
  pbkdf2Salt: string,
) {
  const db = await getDB();

  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);

  await db.put(STORE, {
    userId,
    publicJwk,
    wrappedPrivateKey,
    pbkdf2Salt,
  }, userId);

  // keep in memory
  (window as any).__keys = (window as any).__keys || {};
  (window as any).__keys[userId] = { publicKey, privateKey };
}

// 📦 load keys
export async function loadKeyPair(userId: string) {
  const mem = (window as any).__keys?.[userId];
  if (mem) return mem;

  const db = await getDB();
  const record = await db.get(STORE, userId);

  if (!record) return null;

  return null; // must login again to unlock
}

export async function deleteKeyPair(userId: string) {
  const db = await getDB();
  await db.delete(STORE, userId);

  if ((window as any).__keys) {
    delete (window as any).__keys[userId];
  }
}
