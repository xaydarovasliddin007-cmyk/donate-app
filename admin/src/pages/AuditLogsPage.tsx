import { useState } from 'react';
import { api } from '../api/client';
import type { AuditLogEntry } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { Loading } from '../components/Loading';

export function AuditLogsPage() {
  const [entityType, setEntityType] = useState('');
  const { data, loading, error } = useAsync(
    () => api.get<{ auditLogs: AuditLogEntry[] }>('/admin/audit-logs', { entityType: entityType || undefined, limit: 100 }),
    [entityType],
  );

  return (
    <div>
      <h1>Audit logs</h1>
      <p className="muted">Immutable record of every sensitive admin action — wallet adjustments, refunds, admin changes, top-up decisions.</p>
      <div className="toolbar">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All entity types</option>
          <option value="Wallet">Wallet</option>
          <option value="Order">Order</option>
          <option value="TopUpRequest">TopUpRequest</option>
          <option value="Product">Product</option>
          <option value="ReceivingMethod">ReceivingMethod</option>
          <option value="AdminUser">AdminUser</option>
        </select>
      </div>

      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Metadata</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.auditLogs.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.action}</td>
                <td>
                  {entry.entityType}
                  {entry.entityId && <div className="muted">{entry.entityId}</div>}
                </td>
                <td>{entry.actor ? entry.actor.fullName : entry.actorType}</td>
                <td>
                  <code style={{ fontSize: '0.75rem' }}>
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </code>
                </td>
                <td>{formatDate(entry.createdAt)}</td>
              </tr>
            ))}
            {data.auditLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No audit log entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
