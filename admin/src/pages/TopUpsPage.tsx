import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { TopUpRequestAdmin, TopUpRequestStatus } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { Loading } from '../components/Loading';

const STATUSES: TopUpRequestStatus[] = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'];

function TopUpRow({ request, onChanged }: { request: TopUpRequestAdmin; onChanged: () => void }) {
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
      setRowError(err instanceof ApiError ? err.message : 'Verify failed');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setRowError('Rejection reason is required');
      return;
    }
    setBusy(true);
    setRowError(null);
    try {
      await api.post(`/admin/topups/${request.id}/reject`, { rejectionReason: reason.trim() });
      onChanged();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{request.user.displayName ?? request.user.email ?? request.user.phone ?? request.user.publicId}</td>
      <td>{formatMinor(request.amountMinor, request.currency)}</td>
      <td>
        {request.receivingMethod.cardHolderName}
        <br />
        <span className="muted">{request.receivingMethod.cardNumberMasked}</span>
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
                  Verify
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
                  Reject
                </button>
              </div>
            ) : (
              <div className="toolbar">
                <input
                  placeholder="Rejection reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button className="btn btn-danger" disabled={busy} onClick={reject}>
                  Confirm reject
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setRejecting(false)}>
                  Cancel
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
  const [status, setStatus] = useState<TopUpRequestStatus | ''>('PENDING');
  const { data, loading, error, reload } = useAsync(
    () => api.get<{ topUps: TopUpRequestAdmin[] }>('/admin/topups', { status: status || undefined, limit: 50 }),
    [status],
  );

  return (
    <div>
      <h1>Top-up requests</h1>
      <p className="muted">
        Wallets are credited only after an admin verifies the transfer against a real bank statement — a user's
        claim alone never credits a wallet.
      </p>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value as TopUpRequestStatus | '')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Receiving method</th>
              <th>User reference</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.topUps.map((request) => (
              <TopUpRow key={request.id} request={request} onChanged={reload} />
            ))}
            {data.topUps.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No top-up requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
