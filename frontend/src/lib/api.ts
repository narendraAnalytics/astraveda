// Base URL of the AstraVeda FastAPI backend. Local dev: your PC LAN IP.
// Prod: the Render URL. Set EXPO_PUBLIC_API_URL in frontend/.env.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function api<T>(path: string, { method = 'GET', body, token }: Options = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'EXPO_PUBLIC_API_URL is not set');

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (e.g. a plain "Internal Server Error" from a 500).
    if (!res.ok) {
      throw new ApiError(res.status, text.slice(0, 300) || res.statusText);
    }
    throw new ApiError(res.status, 'Unexpected non-JSON response from the server');
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail ?? res.statusText);
  }
  return data as T;
}
