import { useAuthStore } from '@/stores/auth.store';

/**
 * Typed fetch client with bearer auth and one-shot refresh-token rotation.
 * All server errors surface as ApiError with the backend's code + message.
 */

const API_URL: string = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setAuth, clear } = useAuthStore.getState();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error('refresh failed');
      const data = (await res.json()) as {
        user: ReturnType<typeof useAuthStore.getState>['user'];
        tokens: { accessToken: string; refreshToken: string };
      };
      if (data.user) setAuth(data.user, data.tokens);
      return true;
    } catch {
      clear();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 401 && !retried && opts.auth !== false) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, opts, true);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; issues?: Array<{ path: string; message: string }> };
    } | null;
    throw new ApiError(
      res.status,
      payload?.error?.code ?? 'ERROR',
      payload?.error?.message ?? `Request failed (${res.status})`,
      payload?.error?.issues,
    );
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

export { API_URL };
