import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * NOTE: The WACRM web API under /api/* is authenticated via Supabase SSR cookies set by
 * src/middleware.ts, not bearer tokens. There is currently no bearer-token bridge route on
 * the server, so requests made with this client will fail (401/404) until one is added.
 * Callers must treat failures as "API not available yet", never fabricate data.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL is not configured. Set it in mobile/.env.', 0);
  }

  const token = await getAccessToken();
  if (!token) {
    throw new ApiError('No active session. Sign in again.', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach the WACRM API server.', 0);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body, keep default message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
};
