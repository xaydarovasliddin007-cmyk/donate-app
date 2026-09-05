import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { RefundEntry } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { downloadCsv } from '../lib/csv';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useLocale } from '../i18n/LocaleContext';

export function RefundsPage() {
  const { t } = useLocale();
  const { data, loading, error, reload } = useAsync(
    () => api.get<{ refunds: RefundEntry[] }>('/admin/refunds', { limit: 100 }),
    [],
  );

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `refunds-${new Date().toISOString().slice(0, 10)}.csv`,
      data.refunds.map((refund) => ({
        user: refund.wallet.user.displayName ?? refund.wallet.user.email ?? refund.wallet.user.phone ?? refund.wallet.user.publicId,
        order: refund.order?.orderNumber ?? '',
        amount: formatMinor(refund.amountMinor, refund.currency),
        reason: refund.reason ?? '',
        processedBy: refund.createdByAdmin?.fullName ?? '',
        createdAt: refund.createdAt,
      })),
    );
  }

  return (
    <div>
      <h1>{t('refunds.title')}</h1>
      <p className="muted">{t('refunds.blurb')}</p>
      <div className="toolbar">
        <button className="btn btn-secondary" disabled={!data || data.refunds.length === 0} onClick={exportCsv}>
          {t('common.exportCsv')}
        </button>
      </div>

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
      {error && <ErrorRetry error={error} onRetry={reload} />}
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
