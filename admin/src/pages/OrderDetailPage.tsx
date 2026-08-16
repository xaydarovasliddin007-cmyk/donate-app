import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { OrderDetail } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Loading } from '../components/Loading';
import { useLocale } from '../i18n/LocaleContext';

export function OrderDetailPage() {
  const { t } = useLocale();
  const { orderId } = useParams<{ orderId: string }>();
  const { data, loading, error, reload } = useAsync(
    () => api.get<OrderDetail>(`/admin/orders/${orderId}`),
    [orderId],
  );
  const [refundReason, setRefundReason] = useState('');
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/orders/${orderId}/retry-fulfillment`);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('orderDetail.retryFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/orders/${orderId}/refund`, { reason: refundReason.trim() || undefined });
      setRefundReason('');
      setConfirmingRefund(false);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('orderDetail.refundFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !data) return <p className="form-error">{error}</p>;

  return (
    <div>
      <h1>
        {t('orderDetail.title', { orderNumber: data.orderNumber })} <StatusBadge status={data.status} />
      </h1>
      <div className="panel-grid">
        <div className="panel">
          <h3>{t('orderDetail.summary')}</h3>
          <dl className="detail-list">
            <dt>{t('orderDetail.user')}</dt>
            <dd>
              <Link to={`/users/${data.userId}`}>
                {data.user.displayName ?? data.user.email ?? data.user.phone ?? data.userId}
              </Link>
            </dd>
            <dt>{t('orderDetail.game')}</dt>
            <dd>{data.game.name}</dd>
            <dt>{t('orderDetail.playerId')}</dt>
            <dd>{data.playerId}</dd>
            {data.serverId && (
              <>
                <dt>{t('orderDetail.serverId')}</dt>
                <dd>{data.serverId}</dd>
              </>
            )}
            <dt>{t('orderDetail.amount')}</dt>
            <dd>{formatMinor(data.amountMinor, data.currency)}</dd>
            <dt>{t('orderDetail.created')}</dt>
            <dd>{formatDate(data.createdAt)}</dd>
            {data.failureReason && (
              <>
                <dt>{t('orderDetail.failureReason')}</dt>
                <dd className="form-error">{data.failureReason}</dd>
              </>
            )}
          </dl>
          {actionError && <div className="form-error">{actionError}</div>}
          <div className="toolbar">
            {data.status === 'FAILED' && (
              <button className="btn btn-secondary" disabled={busy} onClick={retry}>
                {t('orderDetail.retryFulfillment')}
              </button>
            )}
            {(data.status === 'COMPLETED' || data.status === 'PAID' || data.status === 'FULFILLING') && (
              <>
                <input
                  placeholder={t('orderDetail.refundReasonPlaceholder')}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
                <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmingRefund(true)}>
                  {t('orderDetail.refundToWallet')}
                </button>
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmingRefund}
          title={t('orderDetail.confirmRefundTitle')}
          message={t('orderDetail.confirmRefundMessage', { amount: formatMinor(data.amountMinor, data.currency) })}
          confirmLabel={t('orderDetail.refundToWallet')}
          danger
          busy={busy}
          onConfirm={refund}
          onCancel={() => setConfirmingRefund(false)}
        />

        <div className="panel">
          <h3>{t('orderDetail.items')}</h3>
          <table>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>× {item.quantity}</td>
                  <td>{formatMinor(item.totalAmountMinor, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>{t('orderDetail.payments')}</h3>
          {data.payments.length === 0 ? (
            <p className="muted">{t('orderDetail.noPayments')}</p>
          ) : (
            <table>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatMinor(payment.amountMinor, payment.currency)}</td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                    <td>{formatDate(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>{t('orderDetail.statusHistory')}</h3>
          <ul className="plain-list">
            {data.statusHistory.map((entry) => (
              <li key={entry.id}>
                {entry.fromStatus ?? '—'} → {entry.toStatus}
                {entry.reason ? ` (${entry.reason})` : ''} · {formatDate(entry.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
