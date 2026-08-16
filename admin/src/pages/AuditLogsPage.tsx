import { useState } from 'react';
import { api } from '../api/client';
import type { AuditLogEntry } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

export function AuditLogsPage() {
  const { t } = useLocale();
  const [entityType, setEntityType] = useState('');
  const { data, loading, error } = useAsync(
    () => api.get<{ auditLogs: AuditLogEntry[] }>('/admin/audit-logs', { entityType: entityType || undefined, limit: 100 }),
    [entityType],
  );

  return (
    <div>
      <h1>{t('auditLogs.title')}</h1>
      <p className="muted">{t('auditLogs.blurb')}</p>
      <div className="toolbar">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">{t('auditLogs.allEntityTypes')}</option>
          <option value="Wallet">Wallet</option>
          <option value="Order">Order</option>
          <option value="TopUpRequest">TopUpRequest</option>
          <option value="Product">Product</option>
          <option value="ReceivingMethod">ReceivingMethod</option>
          <option value="AdminUser">AdminUser</option>
        </select>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('auditLogs.colAction')}</th>
              <th>{t('auditLogs.colEntity')}</th>
              <th>{t('auditLogs.colActor')}</th>
              <th>{t('auditLogs.colMetadata')}</th>
              <th>{t('auditLogs.colWhen')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={5} />
          </tbody>
        </table>
      )}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('auditLogs.colAction')}</th>
              <th>{t('auditLogs.colEntity')}</th>
              <th>{t('auditLogs.colActor')}</th>
              <th>{t('auditLogs.colMetadata')}</th>
              <th>{t('auditLogs.colWhen')}</th>
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
                  {t('auditLogs.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
