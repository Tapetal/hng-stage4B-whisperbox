# WhisperBox — End-to-End Encrypted Messaging

A secure messaging application built with Next.js 14 where messages are encrypted on the client before reaching the server. The server stores only ciphertext blobs — it can never read your messages.

---

## Live Demo
(https://hng-stage4-b-whisperbox.vercel.app)

---

## Setup Instructions

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Production build
npm start        # Serve production build
```

No `.env` file needed — the API base URL is `https://whisperbox.koyeb.app`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                   │
│                                                         │
│  ┌────────────┐     ┌─────────────────┐                │
│  │  Next.js   │     │  Web Crypto API │                │
│  │  React UI  │────▶│  (RSA-OAEP +   │                │
│  │            │     │   AES-GCM)      │                │
│  └────────────┘     └────────┬────────┘                │
│                              │ ciphertext only           │
│  ┌───────────────┐           │                          │
│  │   IndexedDB   │ private   │                          │
│  │  (idb store)  │◀─── key  │                          │
│  └───────────────┘   stays   │                          │
│                       here   ▼                          │
└──────────────────────────────┼──────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────┐
│                WhisperBox Backend (Koyeb)                │
│                                                          │
│  ✓  Stores encrypted blobs          ┌───────────────┐   │
│  ✓  Manages public keys             │   Database    │   │
│  ✓  JWT authentication              │  (ciphertext  │   │
│  ✗  Cannot read plaintext           │   only)       │   │
│  ✗  No access to private keys       └───────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Encryption Flow

### Sending a message

```
plaintext
    │
    ▼
[1] Generate ephemeral AES-GCM-256 key + 96-bit random IV
    │
    ▼
[2] AES-GCM encrypt(plaintext, aesKey, iv)  →  ciphertext
    │
    ├──▶ [3a] RSA-OAEP encrypt(aesKey, recipient.publicKey)  →  encryptedKey
    │
    └──▶ [3b] RSA-OAEP encrypt(aesKey, sender.publicKey)     →  senderEncryptedKey
    │
    ▼
POST /messages  { ciphertext, iv, encryptedKey, senderEncryptedKey, recipientId }
```

### Receiving a message

```
GET /messages/:userId  →  [ { ciphertext, iv, encryptedKey, senderEncryptedKey } ]
    │
    ▼
[1] Determine which wrapped key applies:
    - If I am recipient:  use encryptedKey
    - If I am sender:     use senderEncryptedKey
    │
    ▼
[2] RSA-OAEP decrypt(wrappedKey, myPrivateKey)  →  rawAesKey
    │
    ▼
[3] AES-GCM decrypt(ciphertext, rawAesKey, iv)  →  plaintext
```

---

## Key Management

| Key | Where it lives | How it's stored |
|-----|---------------|-----------------|
| RSA-2048 public key | Backend server | Uploaded as Base64 SPKI on registration |
| RSA-2048 private key | Client only | Stored as JWK in IndexedDB (`whisperbox-keys` DB) |
| Ephemeral AES-256 key | Memory only | Generated per message, never persisted |
| Session JWT | sessionStorage | Cleared when tab closes |

### Why IndexedDB for the private key?
- Survives page refreshes within the same browser session
- Never synced to the server
- Not accessible to other origins
- Can be cleared explicitly on sign-out

### Why both `encryptedKey` and `senderEncryptedKey`?
The AES key is wrapped separately with both the recipient's and the sender's public key. This allows both parties to decrypt the same ciphertext using their respective private keys — the sender can re-read their own sent messages.

---

## Security Decisions

| Decision | Rationale |
|----------|-----------|
| Web Crypto API only | Browser-native, no third-party crypto libraries |
| RSA-OAEP (2048-bit) | Widely supported, safe for key wrapping |
| AES-GCM (256-bit) | Authenticated encryption — prevents tampering |
| 96-bit random IV per message | Prevents IV reuse attacks |
| Token in sessionStorage (not localStorage) | Cleared on tab close; not accessible to third-party scripts the same way |
| No plaintext in localStorage | Complies with the spec; sensitive data stays in IndexedDB or memory |
| Input validation on all forms | Prevents empty/malformed requests |
| CSP headers via next.config.js | Restricts script sources, mitigates XSS |

---

## Trade-offs and Known Limitations

### Device-bound keys
Private keys are stored in IndexedDB on the specific device/browser. If you log in on a new device, new keys are generated — you won't be able to decrypt messages sent to your old keys. A full implementation would use a key backup mechanism (e.g., a password-encrypted key export).

### No true forward secrecy
RSA-OAEP is used for key exchange rather than a Diffie-Hellman ratchet (like Signal Protocol). This means historical messages could be decrypted if the private key is compromised. ECDH with a ratchet (X3DH + Double Ratchet) would provide proper forward secrecy but is significantly more complex.

### Polling instead of WebSockets
Messages are polled every 5 seconds. A production app would use WebSockets or Server-Sent Events for real-time delivery.

### No message integrity beyond AES-GCM
AES-GCM provides authenticated encryption (AEAD), which means tampered ciphertexts are detected. There's no additional message signing with the sender's private key (which would prevent spoofing by the server). Adding RSA-PSS signatures would close this gap.

### Password not used as key material
The user's password is used only for backend authentication (JWT), not for encrypting the private key at rest. A stronger design would wrap the private key with a key derived from the user's password (PBKDF2 → AES-KW), so even a compromised IndexedDB wouldn't expose the raw private key JWK.

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx           Root layout + security headers
│   ├── page.tsx             Redirect to /dashboard
│   ├── login/page.tsx       Login page
│   ├── signup/page.tsx      Registration page
│   └── dashboard/page.tsx   Main app (protected)
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx    Email + password login
│   │   └── SignupForm.tsx   Registration with key generation
│   ├── chat/
│   │   ├── ContactList.tsx  User list sidebar
│   │   └── ChatWindow.tsx   Message view + compose
│   └── layout/
│       └── DashboardShell.tsx  App shell with sidebar
├── hooks/
│   ├── useSession.ts        Session state
│   └── useChat.ts           Message load + encrypt/decrypt + send
├── lib/
│   ├── api/
│   │   └── client.ts        Typed fetch wrapper for WhisperBox API
│   ├── crypto/
│   │   ├── keys.ts          RSA key generation + IndexedDB storage
│   │   └── encryption.ts    AES-GCM encrypt/decrypt + RSA key wrapping
│   └── store/
│       └── session.ts       JWT session (sessionStorage, not localStorage)
└── types/
    └── index.ts             Shared TypeScript types
```
