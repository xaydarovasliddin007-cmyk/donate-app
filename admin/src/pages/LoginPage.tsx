import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, isApiError } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

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
        <div className="login-showcase-mark">U</div>
        <h2>{t('login.showcaseTitle')}</h2>
        <p>{t('login.showcaseBlurb')}</p>
        <ul className="login-showcase-points">
          <li>{t('login.point1')}</li>
          <li>{t('login.point2')}</li>
          <li>{t('login.point3')}</li>
        </ul>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-mark">U</div>
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
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
