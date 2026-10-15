import { useState } from 'react';
import { ArrowUpRight, LoaderCircle, Send } from 'lucide-react';
import type { Locale } from '../i18n';
import type { Session } from '../types';
import { ApiError, completeSocialSignIn, errorText, startSocialSignIn, type SocialAuthRequest } from '../services/api';
import { inTelegram, telegram } from '../services/telegram';

export function SocialAuthCode({ provider, locale, link, disabled, onBusyChange, onLogin }: {
  provider: 'google' | 'telegram'; locale: Locale; link: boolean; disabled: boolean;
  onBusyChange: (busy: boolean) => void; onLogin: (session: Session) => void;
}) {
  const [request, setRequest] = useState<SocialAuthRequest | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const ru = locale === 'ru';
  const name = provider === 'google' ? 'Google' : 'Telegram';
  function open(url: string) {
    if (inTelegram()) {
      if (provider === 'telegram') telegram()?.openTelegramLink(url);
      else telegram()?.openLink(url);
    } else window.open(url, '_blank', 'noopener,noreferrer');
  }
  async function start() {
    if (disabled || pending) return;
    setPending(true); onBusyChange(true); setError(''); setCode('');
    try { const next = await startSocialSignIn(provider, locale, link); setRequest(next); open(next.authorizeUrl); }
    catch (err) { setError(errorText(err)); }
    finally { setPending(false); onBusyChange(false); }
  }
  async function complete() {
    if (!request || code.length !== 8 || pending || disabled) return;
    setPending(true); onBusyChange(true); setError('');
    try { onLogin(await completeSocialSignIn(request, code)); }
    catch (err) {
      setError(err instanceof ApiError && err.status === 401
        ? ru ? 'Код неверен или истёк. Проверьте код или начните заново.' : 'Kod noto‘g‘ri yoki eskirgan. Kodni tekshiring yoki yangidan boshlang.'
        : err instanceof ApiError && err.status === 409
          ? ru ? 'Этот способ входа уже связан с другим аккаунтом UZDONATE. Войдите в существующий аккаунт.' : 'Bu kirish usuli boshqa UZDONATE hisobiga ulangan. Mavjud hisobingizga kiring.'
          : errorText(err));
    } finally { setPending(false); onBusyChange(false); }
  }
  return <div className="social-code-flow">
    {!request ? <button type="button" className="button secondary social-provider" onClick={start} disabled={disabled || pending}>
      {pending ? <LoaderCircle size={18} className="spin"/> : provider === 'telegram' ? <Send size={18}/> : <span className="google-letter" aria-hidden="true">G</span>}
      {ru ? link ? `Подключить ${name}` : `Войти через ${name}` : link ? `${name} hisobini ulash` : `${name} orqali kirish`}
    </button> : <div className="social-code-entry">
      <p className="notice">{ru ? `${name} подтвердит ваш аккаунт. Вернитесь сюда и введите полученный 8-значный код.` : `${name} hisobingizni tasdiqlaydi. Shu oynaga qaytib, olingan 8 xonali kodni kiriting.`}</p>
      <a className="button secondary" href={request.authorizeUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (inTelegram()) { event.preventDefault(); open(request.authorizeUrl); } }}><ArrowUpRight size={16}/>{ru ? `Открыть ${name}` : `${name}ni ochish`}</a>
      <label>{ru ? `${name}: код подтверждения` : `${name} tasdiqlash kodi`}<input aria-label={ru ? `${name}: код подтверждения` : `${name} tasdiqlash kodi`} inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} disabled={disabled || pending} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void complete(); } }}/></label>
      <button type="button" className="button primary" disabled={disabled || pending || code.length !== 8} onClick={complete}>{pending && <LoaderCircle size={16} className="spin"/>}{ru ? 'Подтвердить вход' : 'Kirishni tasdiqlash'}</button>
      <button type="button" className="text-button" disabled={disabled || pending} onClick={start}>{ru ? 'Начать заново' : 'Yangidan boshlash'}</button>
    </div>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </div>;
}
