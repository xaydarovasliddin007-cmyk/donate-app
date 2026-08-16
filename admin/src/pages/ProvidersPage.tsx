import { api } from '../api/client';
import type { Provider } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

export function ProvidersPage() {
  const { t } = useLocale();
  const { data, loading, error } = useAsync(() => api.get<{ providers: Provider[] }>('/admin/providers'), []);

  function successRateLabel(rate: number | null): string {
    if (rate === null) return t('providers.noAttempts');
    return `${(rate * 100).toFixed(1)}%`;
  }

  return (
    <div>
      <h1>{t('providers.title')}</h1>
      <p className="muted">{t('providers.blurb')}</p>
      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('providers.colCode')}</th>
              <th>{t('providers.colName')}</th>
              <th>{t('providers.colType')}</th>
              <th>{t('providers.colActive')}</th>
              <th>{t('providers.colHealth')}</th>
              <th>{t('providers.colSuccessRate')}</th>
              <th>{t('providers.colAttempts')}</th>
              <th>{t('providers.colLastChecked')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={8} />
          </tbody>
        </table>
      )}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('providers.colCode')}</th>
              <th>{t('providers.colName')}</th>
              <th>{t('providers.colType')}</th>
              <th>{t('providers.colActive')}</th>
              <th>{t('providers.colHealth')}</th>
              <th>{t('providers.colSuccessRate')}</th>
              <th>{t('providers.colAttempts')}</th>
              <th>{t('providers.colLastChecked')}</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.code}</td>
                <td>{provider.name}</td>
                <td>{provider.type}</td>
                <td>{provider.isActive ? t('common.active') : t('common.inactive')}</td>
                <td>
                  <StatusBadge status={provider.healthStatus} />
                </td>
                <td>{successRateLabel(provider.successRate)}</td>
                <td className="muted">
                  {t('providers.attemptsSummary', {
                    ok: provider.succeededAttempts,
                    failed: provider.failedAttempts,
                    total: provider.totalAttempts,
                  })}
                </td>
                <td>{provider.lastCheckedAt ? formatDate(provider.lastCheckedAt) : '—'}</td>
              </tr>
            ))}
            {data.providers.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {t('providers.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
