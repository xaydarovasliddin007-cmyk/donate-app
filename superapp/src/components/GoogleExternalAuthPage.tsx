import { useEffect, useState } from 'react';
import { Copy, LoaderCircle, Send, ShieldCheck } from 'lucide-react';
import { api, errorText } from '../services/api';
import { BrandMark } from './BrandMark';
import { GoogleSignInButton } from './GoogleSignInButton';

interface RequestInfo { provider: string; intent: string; locale: string; googleClientId: string | null }
export function GoogleExternalAuthPage({ requestId }: { requestId: string }) {
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ru = info?.locale === 'ru';
  useEffect(() => {
    let cancelled = false;
    void api<RequestInfo>(`/auth/requests/${encodeURIComponent(requestId)}`, undefined, false).then((next) => {
      if (cancelled) return;
      if (next.provider !== 'google' || !next.googleClientId) throw new Error('Invalid request');
      setInfo(next);
    }).catch(() => { if (!cancelled) setError('Kirish so‘rovi eskirgan. UZDONATE ilovasiga qaytib, yangidan boshlang.'); });
    return () => { cancelled = true; };
  }, [requestId]);
  async function confirm(idToken: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await api<{ code: string }>(`/auth/requests/${requestId}/google`, { idToken }, false); setCode(result.code); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <main className="identity-page"><section className="identity-card">
    <BrandMark className="identity-brand"/><span className="identity-eyebrow">UZDONATE ID</span>
    <h1>{ru ? 'Единый аккаунт UZDONATE' : 'Yagona UZDONATE hisobi'}</h1>
    {code ? <>
      <ShieldCheck size={30}/><p>{ru ? 'Google подтвердил ваш аккаунт. Вернитесь в приложение и введите этот код.' : 'Google hisobingizni tasdiqladi. Ilovaga qaytib, ushbu kodni kiriting.'}</p>
      <strong className="identity-code">{code}</strong><small>{ru ? 'Код действует до 5 минут. Не передавайте его другим.' : 'Kod 5 daqiqagacha amal qiladi. Uni boshqalarga bermang.'}</small>
      <button className="button primary" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setCopied(false); } }}><Copy size={16}/>{ru ? copied ? 'Скопировано' : 'Скопировать код' : copied ? 'Nusxalandi' : 'Kodni nusxalash'}</button>
      <a className="button secondary" href="https://t.me/uzdonate1bot"><Send size={16}/>{ru ? 'Вернуться в Telegram' : 'Telegramga qaytish'}</a>
    </> : <>
      <p>{ru ? 'Подтвердите Google в браузере. Затем введите полученный код в UZDONATE.' : 'Google hisobingizni brauzerda tasdiqlang. Keyin olingan kodni UZDONATE ilovasiga kiriting.'}</p>
      {info?.googleClientId ? <GoogleSignInButton clientId={info.googleClientId} locale={ru ? 'ru' : 'uz'} onCredential={confirm} busy={busy} onUnavailable={() => setError(ru ? 'Не удалось загрузить Google. Проверьте интернет.' : 'Google yuklanmadi. Internet aloqasini tekshiring.')}/> : !error && <LoaderCircle size={24} className="spin"/>}
    </>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <a className="muted" href="/webapp/privacy.html">{ru ? 'Конфиденциальность' : 'Maxfiylik'}</a>
  </section></main>;
}
