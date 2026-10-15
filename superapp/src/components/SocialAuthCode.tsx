import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, Send } from 'lucide-react';
import type { Locale } from '../i18n';
import type { Session } from '../types';
import { ApiError, completeSocialSignIn, errorText, startSocialSignIn, type SocialAuthRequest } from '../services/api';
import { inTelegram, telegram } from '../services/telegram';
import { ErrorBox } from './ui';

export function SocialAuthCode({ provider, locale, link, disabled, onBusyChange, onLogin }: {
  provider: 'google' | 'telegram'; locale: Locale; link: boolean; disabled: boolean;
  onBusyChange: (busy: boolean) => void; onLogin: (session: Session) => void;
}) {
  const [request, setRequest] = useState<SocialAuthRequest | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [restartRequired, setRestartRequired] = useState(false);
  const operation = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const errorId = useId();
  useEffect(() => {
    if (!error) return;
    feedback.current?.focus();
    feedback.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);
  const ru = locale === 'ru';
  const name = provider === 'google' ? 'Google' : 'Telegram';
  function conflictMessage(err: ApiError) {
    if (err.code === 'ACCOUNT_CHANGED') return ru ? 'Аккаунт изменился. Нажмите «Начать заново».' : 'Hisob o‘zgardi. «Yangidan boshlash»ni bosing.';
    const details = err.details as { reason?: string; accountPublicId?: string } | undefined;
    if (details?.reason === 'GOOGLE_EMAIL_MISMATCH') return ru ? 'Email Google не совпадает с email этого аккаунта. Нажмите «Начать заново» и выберите Google с тем же email.' : 'Google emailingiz bu hisobdagi emailga mos kelmaydi. «Yangidan boshlash»ni bosib, shu emaildagi Google hisobini tanlang.';
    if (details?.reason === 'GOOGLE_ALREADY_LINKED') return ru ? 'К этому аккаунту уже подключён другой Google. Выберите подключённый Google.' : 'Bu hisobga boshqa Google ulangan. Avval ulangan Google hisobini tanlang.';
    const account = typeof details?.accountPublicId === 'string' ? ` ${details.accountPublicId}` : '';
    return ru ? `${name} уже связан с другим аккаунтом UZDONATE${account}. Войдите в существующий аккаунт или нажмите «Начать заново» и выберите другой ${name}.` : `${name} boshqa UZDONATE${account} hisobiga ulangan. Mavjud hisobingizga kiring yoki «Yangidan boshlash»ni bosib, boshqa ${name} hisobini tanlang.`;
  }
  function open(url: string) {
    if (inTelegram()) {
      if (provider === 'telegram') telegram()?.openTelegramLink(url);
      else telegram()?.openLink(url);
    } else window.open(url, '_blank', 'noopener,noreferrer');
  }
  async function start() {
    if (disabled || operation.current) return;
    operation.current = true;
    setPending(true); onBusyChange(true); setError(''); setCode(''); setRestartRequired(false);
    try { const next = await startSocialSignIn(provider, locale, link); setRequest(next); open(next.authorizeUrl); }
    catch (err) { setError(errorText(err)); }
    finally { operation.current = false; setPending(false); onBusyChange(false); }
  }
  async function complete() {
    if (!request || !/^\d{8}$/.test(code) || operation.current || disabled || restartRequired) return;
    operation.current = true;
    setPending(true); onBusyChange(true); setError('');
    try { onLogin(await completeSocialSignIn(request, code)); }
    catch (err) {
      if (err instanceof ApiError && err.status === 409) setRestartRequired(true);
      setError(err instanceof ApiError && err.status === 401
        ? ru ? 'Код неверен или истёк. Проверьте код или начните заново.' : 'Kod noto‘g‘ri yoki eskirgan. Kodni tekshiring yoki yangidan boshlang.'
        : err instanceof ApiError && err.status === 409
          ? conflictMessage(err)
          : errorText(err));
    } finally { operation.current = false; setPending(false); onBusyChange(false); }
  }
  return <div className="social-code-flow">
    {error && <div className="social-code-feedback" id={errorId} ref={feedback} tabIndex={-1}><ErrorBox message={error} locale={locale}/></div>}
    {pending && <p className="notice" role="status" aria-live="polite">{ru ? 'Проверяем аккаунт…' : 'Hisob tekshirilmoqda…'}</p>}
    {!request ? <button type="button" className="button secondary social-provider" onClick={start} disabled={disabled || pending}>
      {pending ? <LoaderCircle size={18} className="spin"/> : provider === 'telegram' ? <Send size={18}/> : <span className="google-letter" aria-hidden="true">G</span>}
      {ru ? link ? `Подключить ${name}` : `Войти через ${name}` : link ? `${name} hisobini ulash` : `${name} orqali kirish`}
    </button> : <div className="social-code-entry">
      <p className="notice">{ru ? `${name} подтвердит ваш аккаунт. Вернитесь сюда и введите полученный 8-значный код.` : `${name} hisobingizni tasdiqlaydi. Shu oynaga qaytib, olingan 8 xonali kodni kiriting.`}</p>
      <a className="button secondary" href={request.authorizeUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (inTelegram()) { event.preventDefault(); open(request.authorizeUrl); } }}><ArrowUpRight size={16}/>{ru ? `Открыть ${name}` : `${name}ni ochish`}</a>
      <label>{ru ? `${name}: код подтверждения` : `${name} tasdiqlash kodi`}<input aria-label={ru ? `${name}: код подтверждения` : `${name} tasdiqlash kodi`} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} inputMode="numeric" autoComplete="one-time-code" maxLength={32} value={code} disabled={disabled || pending || restartRequired} onChange={(event) => { setError(''); setCode(event.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 8)); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void complete(); } }}/></label>
      <button type="button" className="button primary" disabled={disabled || pending || restartRequired || code.length !== 8} onClick={complete}>{pending && <LoaderCircle size={16} className="spin"/>}{ru ? 'Подтвердить вход' : 'Kirishni tasdiqlash'}</button>
      <button type="button" className="text-button" disabled={disabled || pending} onClick={start}>{ru ? 'Начать заново' : 'Yangidan boshlash'}</button>
    </div>}
  </div>;
}
