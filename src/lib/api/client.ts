/**
 * API client for the WhisperBox backend.
 * All message payloads are already encrypted before reaching this layer.
 * This client only handles transport — no crypto here.
 */

const BASE = 'https://whisperbox.koyeb.app';

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

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

// ── Auth endpoints ────────────────────────────────────────────────────────────
export const authApi = {
  signup(body: { username: string; email: string; password: string; publicKey: string }) {
    return request<{ token: string; user: import('@/types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return request<{ token: string; user: import('@/types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  me(token: string) {
    return request<import('@/types').User>('/auth/me', {}, token);
  },
};

// ── Users endpoints ───────────────────────────────────────────────────────────
export const usersApi = {
  getAll(token: string) {
    return request<import('@/types').User[]>('/users', {}, token);
  },

  getById(id: string, token: string) {
    return request<import('@/types').User>(`/users/${id}`, {}, token);
  },

  search(query: string, token: string) {
    return request<import('@/types').User[]>(`/users/search?q=${encodeURIComponent(query)}`, {}, token);
  },
};

// ── Messages endpoints ────────────────────────────────────────────────────────
export const messagesApi = {
  send(
    body: import('@/types').SendMessagePayload,
    token: string,
  ) {
    return request<import('@/types').EncryptedMessage>('/messages', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token);
  },

  getConversation(userId: string, token: string) {
    return request<import('@/types').EncryptedMessage[]>(`/messages/${userId}`, {}, token);
  },

  getInbox(token: string) {
    return request<import('@/types').EncryptedMessage[]>('/messages/inbox', {}, token);
  },

  deleteMessage(id: string, token: string) {
    return request<void>(`/messages/${id}`, { method: 'DELETE' }, token);
  },
};

export { ApiError };
