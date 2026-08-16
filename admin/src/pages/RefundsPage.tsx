import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { RefundEntry } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { Loading } from '../components/Loading';

export function RefundsPage() {
  const { data, loading, error } = useAsync(
    () => api.get<{ refunds: RefundEntry[] }>('/admin/refunds', { limit: 100 }),
    [],
  );

  return (
    <div>
      <h1>Refunds</h1>
      <p className="muted">
        Every refund is a ledger entry (type=REFUND) credited back to the user's wallet — there is no separate
        refund record to fall out of sync with the ledger.
      </p>

      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Order</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Processed by</th>
              <th>When</th>
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
                  No refunds issued yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
