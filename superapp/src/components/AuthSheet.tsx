import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import type { Session } from '../types';
import { api, ApiError, completeAccount, errorText, googleSignIn, login, resetPassword } from '../services/api';
import { tr, type Locale } from '../i18n';
import { Sheet } from './Sheet';
import { ErrorBox } from './ui';
import { GoogleSignInButton } from './GoogleSignInButton';
import { SocialAuthCode } from './SocialAuthCode';
import { inTelegram } from '../services/telegram';

type Mode = 'login' | 'register' | 'reset';
export function AuthSheet({ onClose, onLogin, locale, initialMode = 'login', allowRegister = true, linkOnly = false, socialOnly = false, googleClientId }: {
  onClose: () => void; onLogin: (session: Session) => void; locale: Locale;
  initialMode?: Mode; allowRegister?: boolean; linkOnly?: boolean; socialOnly?: boolean; googleClientId?: string | null;
}) {
  const t = (text: string) => tr(locale, text);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const title = socialOnly ? locale === 'ru' ? 'Способы входа UZDONATE' : 'UZDONATE kirish usullari' : t(mode === 'login' ? 'Hisobga kirish' : mode === 'register' ? 'Ro‘yxatdan o‘tish' : 'Parolni tiklash');
  function changeMode(next: Mode) {
    setMode(next); setSent(false); setCode(''); setPassword(''); setError('');
  }
  async function requestCode() {
    await api(mode === 'register' ? '/auth/register/request-code' : '/auth/password/reset-request',
      mode === 'register' ? { email: email.trim(), displayName: displayName.trim() || undefined, locale } : { email: email.trim() }, false);
    setSent(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'login') onLogin(await login(email.trim(), password));
      else if (!sent) await requestCode();
      else if (mode === 'register') onLogin(await completeAccount(email.trim(), code, password));
      else onLogin(await resetPassword(email.trim(), code, password));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401
        ? mode === 'login' ? 'Email yoki parol noto‘g‘ri.' : 'Kod noto‘g‘ri yoki muddati tugagan. Yangi kod so‘rang.'
        : errorText(err));
    }
    finally { setBusy(false); }
  }
  async function signInWithGoogle(idToken: string) {
    if (busy) return;
    const linkToCurrentAccount = linkOnly || mode === 'register';
    setBusy(true); setError('');
    try { onLogin(await googleSignIn(idToken, locale, linkToCurrentAccount)); }
    catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t(linkToCurrentAccount
          ? 'Google akkaunti bu hisobga xavfsiz ulanmaydi. Shu hisobdagi email bilan bog‘langan Google’ni tanlang.'
          : 'Bu Google akkaunti boshqa hisobga ulangan.'));
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t('Google orqali kirish tasdiqlanmadi. Qayta urinib ko‘ring.'));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t('Google orqali kirish hozircha sozlanmagan.'));
      } else setError(errorText(err));
    } finally { setBusy(false); }
  }
  function googleUnavailable() { setError(t('Google tugmasi yuklanmadi. Internet aloqasini tekshiring.')); }
  return <Sheet title={title} onClose={onClose} busy={busy} className="auth-sheet">
    <form className="checkout-form" onSubmit={submit}>
      {mode === 'register' && <p className="notice">{t('Google yoki email-parol orqali bu hisobga boshqa qurilmadan ham kirasiz. Balans va buyurtmalar saqlanadi.')}</p>}
      {mode !== 'reset' && <div className="social-providers">
        {googleClientId && (inTelegram()
          ? <SocialAuthCode provider="google" locale={locale} link={linkOnly || mode === 'register'} disabled={busy} onBusyChange={setBusy} onLogin={onLogin}/>
          : <GoogleSignInButton clientId={googleClientId} locale={locale} onCredential={signInWithGoogle} busy={busy} onUnavailable={googleUnavailable}/>)}
        {!inTelegram() && <SocialAuthCode provider="telegram" locale={locale} link={linkOnly || mode === 'register'} disabled={busy} onBusyChange={setBusy} onLogin={onLogin}/>}
      </div>}
      {error && <ErrorBox message={error} locale={locale}/>}
      {!socialOnly && <>
      {mode !== 'reset' && <div className="auth-divider"><span>{t('Yoki email bilan')}</span></div>}
      {sent && <p className="notice" role="status">{t('Emailingizga yuborilgan 6 xonali kodni kiriting. Kod 15 daqiqa amal qiladi.')}</p>}
      {mode === 'register' && !sent && <label>{t('Ismingiz')}<input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={busy}/></label>}
      <label>{t('Email')}<input type="email" autoComplete="email" autoFocus required readOnly={sent} disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)}/></label>
      {sent && <label>{t('Tasdiqlash kodi')}<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy}/></label>}
      {(mode === 'login' || sent) && <label>{t(mode === 'login' ? 'Parol' : 'Yangi parol')}<input type="password" aria-label={t(mode === 'login' ? 'Parol' : 'Yangi parol')} aria-describedby={mode !== 'login' ? 'auth-password-hint' : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy}/>{mode !== 'login' && <small id="auth-password-hint" className="muted">{t('Kamida 8 ta belgi')}</small>}</label>}
      <button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <ArrowRight size={18}/>} {t(mode === 'login' ? 'Kirish' : !sent ? 'Kod yuborish' : mode === 'register' ? 'Hisobni saqlash' : 'Parolni yangilash')}</button>
      {sent && <button type="button" className="button secondary" disabled={busy} onClick={() => { setSent(false); setCode(''); setPassword(''); setError(''); }}><ArrowLeft size={17}/>{t('Emailni o‘zgartirish yoki kodni qayta yuborish')}</button>}
      <div className="auth-links">
        {mode === 'login' && <button type="button" disabled={busy} onClick={() => changeMode('reset')}>{t('Parolni unutdingizmi?')}</button>}
        {mode !== 'register' && allowRegister && <button type="button" disabled={busy} onClick={() => changeMode('register')}>{t('Ro‘yxatdan o‘tish')}</button>}
        {mode !== 'login' && !linkOnly && <button type="button" disabled={busy} onClick={() => changeMode('login')}>{t('Mavjud hisobga kirish')}</button>}
      </div>
      </>}
    </form>
  </Sheet>;
}
