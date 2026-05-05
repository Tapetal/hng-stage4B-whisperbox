/**
 * API client for the WhisperBox backend.
 * All message payloads are already encrypted before reaching this layer.
 * This client only handles transport — no crypto here.
 */

import { loadSession, updateAccessToken } from '@/lib/store/session';

const BASE = 'https://whisperbox.koyeb.app';

type ApiUser = {
  id: string;
  username: string;
  display_name?: string;
  public_key?: string;
  wrapped_private_key?: string;
  pbkdf2_salt?: string;
  created_at?: string;
};

type ApiAuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: ApiUser;
};

type ApiMessage = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: {
    ciphertext: string;
    iv: string;
    encryptedKey: string;
    encryptedKeyForSelf: string;
  };
  delivered?: boolean;
  read?: boolean;
  created_at: string;
};

function mapUser(user: ApiUser): import('@/types').User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    publicKey: user.public_key,
    wrappedPrivateKey: user.wrapped_private_key,
    pbkdf2Salt: user.pbkdf2_salt,
    createdAt: user.created_at ?? '',
  };
}

function mapAuth(body: ApiAuthResponse): import('@/types').AuthResponse {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: mapUser(body.user),
  };
}

function mapMessage(message: ApiMessage): import('@/types').EncryptedMessage {
  return {
    id: message.id,
    senderId: message.from_user_id,
    recipientId: message.to_user_id,
    ciphertext: message.payload.ciphertext,
    iv: message.payload.iv,
    encryptedKey: message.payload.encryptedKey,
    senderEncryptedKey: message.payload.encryptedKeyForSelf,
    delivered: message.delivered,
    read: message.read,
    status: message.read ? 'read' : message.delivered ? 'delivered' : 'sent',
    createdAt: message.created_at,
  };
}

export function mapRealtimeMessage(raw: any): import('@/types').EncryptedMessage | null {
  const message = raw?.event ? raw : { event: 'message.receive', ...raw };
  const payload = message.payload;
  const id = message.id;
  const senderId = message.from_user_id ?? message.senderId ?? message.sender_id;
  const recipientId = message.to_user_id ?? message.recipientId ?? message.recipient_id;
  const createdAt = message.created_at ?? message.createdAt ?? new Date().toISOString();
  const delivered = message.delivered;
  const read = message.read;

  if (!payload || !id || !senderId || !recipientId) return null;

  const senderEncryptedKey =
    payload.encryptedKeyForSelf ??
    payload.senderEncryptedKey ??
    payload.encrypted_key_for_self;

  if (!payload.ciphertext || !payload.iv || !payload.encryptedKey || !senderEncryptedKey) {
    return null;
  }

  return {
    id,
    senderId,
    recipientId,
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    encryptedKey: payload.encryptedKey,
    senderEncryptedKey,
    delivered,
    read,
    status: read ? 'read' : delivered ? 'delivered' : 'sent',
    createdAt,
  };
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  async function send(accessToken?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    return fetch(`${BASE}${path}`, { ...options, headers });
  }

  async function refreshAccessToken() {
    const session = loadSession();
    if (!session?.refreshToken) return null;

    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });

    if (!res.ok) return null;

    const body = await res.json() as { access_token: string };
    updateAccessToken(body.access_token);
    return body.access_token;
  }

  let res = await send(token);

  if (res.status === 401 && token) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      res = await send(refreshedToken);
    }
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.message || body.error || body.detail || msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export async function refreshSessionToken() {
  const session = loadSession();
  if (!session?.refreshToken) return null;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  if (!res.ok) return null;

  const body = await res.json() as { access_token: string };
  updateAccessToken(body.access_token);
  return body.access_token;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────
export const authApi = {
  async signup(body: {
    username: string;
    displayName: string;
    password: string;
    publicKey: string;
    wrappedPrivateKey: string;
    pbkdf2Salt: string;
  }) {
    const res = await request<ApiAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: body.username,
        display_name: body.displayName,
        password: body.password,
        public_key: body.publicKey,
        wrapped_private_key: body.wrappedPrivateKey,
        pbkdf2_salt: body.pbkdf2Salt,
      }),
    });
    return mapAuth(res);
  },

  async login(body: { username: string; password: string }) {
    const res = await request<ApiAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return mapAuth(res);
  },

  async me(token: string) {
    return mapUser(await request<ApiUser>('/auth/me', {}, token));
  },

  refresh(refreshToken: string) {
    return request<{ access_token: string; token_type: string; expires_in: number }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  logout(refreshToken: string, token: string) {
    return request<{ detail: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }, token);
  },
};

// ── Users endpoints ───────────────────────────────────────────────────────────
export const usersApi = {
  async getPublicKey(id: string, token: string) {
    const res = await request<{ public_key: string }>(`/users/${id}/public-key`, {}, token);
    return res.public_key;
  },

  async search(query: string, token: string) {
    const users = await request<ApiUser[]>(`/users/search?q=${encodeURIComponent(query)}`, {}, token);
    return users.map(mapUser);
  },
};

export const conversationsApi = {
  async getAll(token: string) {
    const conversations = await request<Array<{
      user_id: string;
      display_name?: string;
      username: string;
      last_message_at?: string;
    }>>('/conversations', {}, token);

    return conversations.map(c => ({
      id: c.user_id,
      username: c.username,
      displayName: c.display_name,
      createdAt: c.last_message_at ?? '',
    }));
  },
};

// ── Messages endpoints ────────────────────────────────────────────────────────
export const messagesApi = {
  send(
    body: import('@/types').SendMessagePayload,
    token: string,
  ) {
    return request<ApiMessage>('/messages', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token).then(mapMessage);
  },

  async getConversation(userId: string, token: string) {
    const messages = await request<ApiMessage[]>(`/conversations/${userId}/messages`, {}, token);
    return messages.map(mapMessage);
  },

  deleteMessage(id: string, token: string) {
    return request<void>(`/messages/${id}`, { method: 'DELETE' }, token);
  },
};

export { ApiError };
