import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { UserDetail } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { Loading } from '../components/Loading';
import { ErrorRetry } from '../components/ErrorRetry';
import { useLocale } from '../i18n/LocaleContext';

export function UserDetailPage() {
  const { t } = useLocale();
  const { userId } = useParams<{ userId: string }>();
  const { data, loading, error, reload } = useAsync(
    () => api.get<UserDetail>(`/admin/users/${userId}`),
    [userId],
  );

  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [discountInput, setDiscountInput] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSaved, setDiscountSaved] = useState(false);

  async function submitDiscount(event: FormEvent) {
    event.preventDefault();
    setDiscountError(null);
    setDiscountSaved(false);
    const pct = Number(discountInput);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      setDiscountError(t('userDetail.discountOutOfRange'));
      return;
    }
    setSavingDiscount(true);
    try {
      await api.patch(`/admin/users/${userId}/discount`, { discountPercent: pct });
      setDiscountSaved(true);
      reload();
    } catch (err) {
      setDiscountError(err instanceof ApiError ? err.message : t('userDetail.discountFailed'));
    } finally {
      setSavingDiscount(false);
    }
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const amountMajor = Number(amount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      setFormError(t('userDetail.enterPositiveAmount'));
      return;
    }
    if (!reason.trim()) {
      setFormError(t('userDetail.reasonRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/users/${userId}/wallet/adjust`, {
        direction,
        amountMinor: Math.round(amountMajor * 100),
        reason: reason.trim(),
      });
      setAmount('');
      setReason('');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('userDetail.adjustmentFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorRetry error={error} onRetry={reload} />;
  if (!data) return null;

  const { user, wallet, recentOrders, recentTransactions, activeSessions } = data;

  return (
    <div>
      <h1>{user.displayName ?? user.email ?? user.phone ?? user.publicId}</h1>
      <div className="panel-grid">
        <div className="panel">
          <h3>{t('userDetail.account')}</h3>
          <dl className="detail-list">
            <dt>{t('userDetail.id')}</dt>
            <dd>{user.publicId}</dd>
            <dt>{t('userDetail.email')}</dt>
            <dd>{user.email ?? '—'}</dd>
            <dt>{t('userDetail.phone')}</dt>
            <dd>{user.phone ?? '—'}</dd>
            <dt>{t('userDetail.telegramId')}</dt>
            <dd>{user.telegramId ?? '—'}</dd>
            <dt>{t('userDetail.role')}</dt>
            <dd>{user.role}</dd>
            <dt>{t('userDetail.status')}</dt>
            <dd>
              <StatusBadge status={user.status} />
            </dd>
            <dt>{t('userDetail.joined')}</dt>
            <dd>{formatDate(user.createdAt)}</dd>
            <dt>{t('userDetail.discount')}</dt>
            <dd>{user.discountPercent > 0 ? `${user.discountPercent}%` : t('userDetail.noDiscount')}</dd>
          </dl>
          <form className="stack-form" onSubmit={submitDiscount}>
            <div className="toolbar">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder={t('userDetail.discountPlaceholder')}
                value={discountInput}
                onChange={(e) => {
                  setDiscountInput(e.target.value);
                  setDiscountSaved(false);
                }}
              />
              <button className="btn btn-secondary" type="submit" disabled={savingDiscount}>
                {savingDiscount ? t('userDetail.applyingDiscount') : t('userDetail.applyDiscount')}
              </button>
            </div>
            <p className="muted">{t('userDetail.discountHint')}</p>
            {discountError && <div className="form-error">{discountError}</div>}
            {discountSaved && !discountError && <div className="form-success">{t('userDetail.discountUpdated')}</div>}
          </form>
        </div>

        <div className="panel">
          <h3>{t('userDetail.wallet')}</h3>
          <p className="stat-value">{formatMinor(wallet.balanceMinor, wallet.currency)}</p>
          <form className="stack-form" onSubmit={submitAdjustment}>
            <div className="toolbar">
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'CREDIT' | 'DEBIT')}>
                <option value="CREDIT">{t('userDetail.credit')}</option>
                <option value="DEBIT">{t('userDetail.debit')}</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('userDetail.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <input
              placeholder={t('userDetail.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {formError && <div className="form-error">{formError}</div>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? t('userDetail.applying') : t('userDetail.applyAdjustment')}
            </button>
          </form>
        </div>

        <div className="panel">
          <h3>{t('userDetail.activeSessions')}</h3>
          {activeSessions.length === 0 ? (
            <p className="muted">{t('userDetail.noSessions')}</p>
          ) : (
            <ul className="plain-list">
              {activeSessions.map((session) => (
                <li key={session.id}>
                  {session.userAgent ?? t('userDetail.unknownDevice')} · {session.ipAddress ?? '—'} ·{' '}
                  {formatDate(session.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h3>{t('userDetail.recentOrders')}</h3>
          {recentOrders.length === 0 ? (
            <p className="muted">{t('userDetail.noOrders')}</p>
          ) : (
            <table>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}>{order.orderNumber}</Link>
                    </td>
                    <td>{order.game.name}</td>
                    <td>{formatMinor(order.amountMinor, order.currency)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>{t('userDetail.recentTransactions')}</h3>
          {recentTransactions.length === 0 ? (
            <p className="muted">{t('userDetail.noTransactions')}</p>
          ) : (
            <table>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.type}</td>
                    <td>
                      {tx.direction === 'CREDIT' ? '+' : '−'}
                      {formatMinor(tx.amountMinor, tx.currency)}
                    </td>
                    <td className="muted">{tx.reason ?? tx.reference ?? '—'}</td>
                    <td>{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
