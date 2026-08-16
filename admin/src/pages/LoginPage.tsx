import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, isApiError } from '../auth/AuthContext';

export function LoginPage() {
  const { admin, login } = useAuth();
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
      setError(isApiError(err) ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-showcase" aria-hidden="true">
        <div className="login-showcase-mark">U</div>
        <h2>UZDONATE</h2>
        <p>Operate top-ups, orders, and payouts from one console — built for speed and trust.</p>
        <ul className="login-showcase-points">
          <li>Wallet adjustments are always audit-logged</li>
          <li>Top-ups are verified by a human against a bank statement</li>
          <li>Every sensitive action leaves a trace</li>
        </ul>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-mark">U</div>
          <h1>Sign in</h1>
          <p className="muted login-subtitle">Enter your admin credentials to continue</p>
          <label>
            Email
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
            Password
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
