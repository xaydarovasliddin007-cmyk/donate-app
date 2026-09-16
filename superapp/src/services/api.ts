import type { Session } from '../types';
import { telegram, inTelegram } from './telegram';

const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
let session: Session | null = null;
let authPromise: Promise<Session> | null = null;
let refreshPromise: Promise<Session> | null = null;
const key = 'uzdonate_session_v2';
try { session = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { /* Storage may be unavailable in a webview. */ }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INSUFFICIENT_BALANCE') return "Balans yetarli emas. Hisobingizni to'ldiring.";
    if (error.status === 401) return "Hisobga qayta kiring yoki mini-ilovani qayta oching.";
    if (error.status === 429) return "Juda ko'p so'rov yuborildi. Bir ozdan keyin qayta urinib ko'ring.";
    if (error.status >= 500) return "Xizmat bilan bog'lanib bo'lmadi. Bir ozdan keyin qayta urinib ko'ring.";
    return error.message;
  }
  return "Internet aloqasini tekshiring va qayta urinib ko'ring.";
}
function save(next: Session) {
  session = next;
  try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the in-memory session. */ }
  return next;
}
async function raw<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error?.code || 'HTTP_ERROR', data?.error?.message || 'So\'rov bajarilmadi', data?.error?.details);
  return data as T;
}
export async function signIn(): Promise<Session> {
  if (!authPromise) authPromise = (async () => {
    // Telegram's signed identity is always verified afresh on launch.
    if (inTelegram()) return save(await raw<Session>('/auth/telegram', { initData: telegram()!.initData }));
    if (session?.refreshToken) {
      try { return save(await raw<Session>('/auth/refresh', { refreshToken: session.refreshToken })); }
      catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
    }
    let deviceId: string;
    try {
      deviceId = localStorage.getItem('uzdonate_device_v2') || crypto.randomUUID();
      localStorage.setItem('uzdonate_device_v2', deviceId);
    } catch { deviceId = crypto.randomUUID(); }
    return save(await raw<Session>('/auth/guest', { deviceId, locale: 'uz' }));
  })().finally(() => { authPromise = null; });
  return authPromise;
}
export async function login(email: string, password: string) {
  return save(await raw<Session>('/auth/login', { email, password }));
}
export async function api<T>(path: string, body?: unknown, auth = true): Promise<T> {
  if (auth && !session) await signIn();
  try { return await raw<T>(path, body, auth ? session?.accessToken : undefined); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !auth || !session?.refreshToken) throw error;
    if (!refreshPromise) refreshPromise = raw<Session>('/auth/refresh', { refreshToken: session.refreshToken })
      .then(save).finally(() => { refreshPromise = null; });
    await refreshPromise;
    return raw<T>(path, body, session?.accessToken);
  }
}
