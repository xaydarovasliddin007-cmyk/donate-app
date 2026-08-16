import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { RefundEntry } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

export function RefundsPage() {
  const { t } = useLocale();
  const { data, loading, error } = useAsync(
    () => api.get<{ refunds: RefundEntry[] }>('/admin/refunds', { limit: 100 }),
    [],
  );

  return (
    <div>
      <h1>{t('refunds.title')}</h1>
      <p className="muted">{t('refunds.blurb')}</p>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('refunds.colUser')}</th>
              <th>{t('refunds.colOrder')}</th>
              <th>{t('refunds.colAmount')}</th>
              <th>{t('refunds.colReason')}</th>
              <th>{t('refunds.colProcessedBy')}</th>
              <th>{t('refunds.colWhen')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={6} />
          </tbody>
        </table>
      )}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('refunds.colUser')}</th>
              <th>{t('refunds.colOrder')}</th>
              <th>{t('refunds.colAmount')}</th>
              <th>{t('refunds.colReason')}</th>
              <th>{t('refunds.colProcessedBy')}</th>
              <th>{t('refunds.colWhen')}</th>
            </tr>
          </thead>
          <tbody>
            {data.refunds.map((refund) => (
              <tr key={refund.id}>
                <td>
                  <Link to={`/users/${refund.wallet.user.id}`}>
                    {refund.wallet.user.displayName ??
                      refund.wallet.user.email ??
                      refund.wallet.user.phone ??
                      refund.wallet.user.publicId}
                  </Link>
                </td>
                <td>
                  {refund.order ? <Link to={`/orders/${refund.order.id}`}>{refund.order.orderNumber}</Link> : '—'}
                </td>
                <td>{formatMinor(refund.amountMinor, refund.currency)}</td>
                <td className="muted">{refund.reason ?? '—'}</td>
                <td>{refund.createdByAdmin?.fullName ?? '—'}</td>
                <td>{formatDate(refund.createdAt)}</td>
              </tr>
            ))}
            {data.refunds.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('refunds.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
