import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, isApiError } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { BrandMark } from '../components/BrandMark';
import { ArrowRightIcon, AuditIcon, CardIcon, OrdersIcon } from '../components/icons';

export function LoginPage() {
  const { admin, login } = useAuth();
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(isApiError(err) ? err.message : t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <LanguageSwitcher className="login-lang-switch" />
      <div className="login-showcase" aria-hidden="true">
        <BrandMark className="login-showcase-mark" />
        <span className="login-eyebrow">{t('nav.tagline')}</span>
        <h2>{t('login.showcaseTitle')}</h2>
        <p>{t('login.showcaseBlurb')}</p>
        <ul className="login-showcase-points">
          <li><span className="login-point-icon"><CardIcon /></span><span>{t('login.point1')}</span></li>
          <li><span className="login-point-icon"><OrdersIcon /></span><span>{t('login.point2')}</span></li>
          <li><span className="login-point-icon"><AuditIcon /></span><span>{t('login.point3')}</span></li>
        </ul>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} aria-busy={submitting}>
          <div className="login-card-brand">
            <BrandMark className="login-card-mark" />
            <span><span className="brand-wordmark">UZ<span>DONATE</span></span><small>{t('nav.tagline')}</small></span>
          </div>
          <h1>{t('login.title')}</h1>
          <p className="muted login-subtitle">{t('login.subtitle')}</p>
          <label>
            {t('login.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@uzdonate.com"
              required
              autoFocus
              autoComplete="username"
            />
          </label>
          <label>
            {t('login.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {submitting ? t('login.signingIn') : t('login.signIn')}
            {!submitting && <ArrowRightIcon width={17} height={17} aria-hidden="true" />}
          </button>
        </form>
      </div>
    </div>
  );
}
