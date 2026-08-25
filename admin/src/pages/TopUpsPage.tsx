import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { TopUpRequestAdmin, TopUpRequestStatus } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

const STATUSES: TopUpRequestStatus[] = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'];

function TopUpRow({ request, onChanged }: { request: TopUpRequestAdmin; onChanged: () => void }) {
  const { t } = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setRowError(null);
    try {
      await api.post(`/admin/topups/${request.id}/verify`);
      onChanged();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : t('topups.verifyFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setRowError(t('topups.reasonRequired'));
      return;
    }
    setBusy(true);
    setRowError(null);
    try {
      await api.post(`/admin/topups/${request.id}/reject`, { rejectionReason: reason.trim() });
      onChanged();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : t('topups.rejectFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{request.user.displayName ?? request.user.email ?? request.user.phone ?? request.user.publicId}</td>
      <td>{formatMinor(request.amountMinor, request.currency)}</td>
      <td>
        {request.receivingMethod ? (
          <>
            {request.receivingMethod.cardHolderName}
            <br />
            <span className="muted">{request.receivingMethod.cardNumber}</span>
          </>
        ) : (
          <span className="muted">{t('topups.methodNotYetMatched')}</span>
        )}
      </td>
      <td className="muted">{request.userReference ?? '—'}</td>
      <td>
        <StatusBadge status={request.status} />
        {request.rejectionReason && <div className="muted">{request.rejectionReason}</div>}
      </td>
      <td>{formatDate(request.createdAt)}</td>
      <td>
        {request.status === 'PENDING' && (
          <div className="stack-form">
            {rowError && <div className="form-error">{rowError}</div>}
            {!rejecting ? (
              <div className="toolbar">
                <button className="btn btn-primary" disabled={busy} onClick={verify}>
                  {t('topups.verify')}
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
                  {t('topups.reject')}
                </button>
              </div>
            ) : (
              <div className="toolbar">
                <input
                  placeholder={t('topups.rejectionPlaceholder')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button className="btn btn-danger" disabled={busy} onClick={reject}>
                  {t('topups.confirmReject')}
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setRejecting(false)}>
                  {t('topups.cancel')}
                </button>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function TopUpsPage() {
  const { t } = useLocale();
  const [status, setStatus] = useState<TopUpRequestStatus | ''>('PENDING');
  const { data, loading, error, reload } = useAsync(
    () => api.get<{ topUps: TopUpRequestAdmin[] }>('/admin/topups', { status: status || undefined, limit: 50 }),
    [status],
  );

  return (
    <div>
      <h1>{t('topups.title')}</h1>
      <p className="muted">{t('topups.blurb')}</p>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value as TopUpRequestStatus | '')}>
          <option value="">{t('orders.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('topups.colUser')}</th>
              <th>{t('topups.colAmount')}</th>
              <th>{t('topups.colMethod')}</th>
              <th>{t('topups.colReference')}</th>
              <th>{t('topups.colStatus')}</th>
              <th>{t('topups.colRequested')}</th>
              <th>{t('topups.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={7} />
          </tbody>
        </table>
      )}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('topups.colUser')}</th>
              <th>{t('topups.colAmount')}</th>
              <th>{t('topups.colMethod')}</th>
              <th>{t('topups.colReference')}</th>
              <th>{t('topups.colStatus')}</th>
              <th>{t('topups.colRequested')}</th>
              <th>{t('topups.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.topUps.map((request) => (
              <TopUpRow key={request.id} request={request} onChanged={reload} />
            ))}
            {data.topUps.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {t('topups.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
