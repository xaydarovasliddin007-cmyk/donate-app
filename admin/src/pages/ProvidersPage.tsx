import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Provider } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { ActiveBadge } from '../components/ActiveBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n/LocaleContext';

export function ProvidersPage() {
  const { t } = useLocale();
  const { showError, showSuccess } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get<{ providers: Provider[] }>('/admin/providers'), []);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<Provider | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function syncCatalog() {
    setSyncing(true);
    try {
      await api.post('/admin/system/sync-catalog');
      showSuccess('Katalog va provayderlar muvaffaqiyatli sinxronlandi!');
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Sinxronlashda xatolik yuz berdi');
    } finally {
      setSyncing(false);
    }
  }

  function successRateLabel(rate: number | null): string {
    if (rate === null) return t('providers.noAttempts');
    return `${(rate * 100).toFixed(1)}%`;
  }

  async function setActive(provider: Provider, isActive: boolean) {
    setTogglingId(provider.id);
    try {
      await api.patch(`/admin/providers/${provider.id}`, { isActive });
      setConfirmingDeactivate(null);
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('providers.statusFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{t('providers.title')}</h1>
          <p className="muted">{t('providers.blurb')}</p>
        </div>
        <button className="btn btn-primary" onClick={syncCatalog} disabled={syncing}>
          {syncing ? 'Sinxronlanmoqda…' : '🔄 Provayderlarni yangilash'}
        </button>
      </div>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={9} />
          </tbody>
        </table>
      )}
      {error && <ErrorRetry error={error} onRetry={reload} />}
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.code}</td>
                <td>{provider.name}</td>
                <td>{provider.type}</td>
                <td>
                  <ActiveBadge active={provider.isActive} />
                </td>
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
                <td>
                  <button
                    className="btn btn-secondary"
                    disabled={togglingId === provider.id}
                    onClick={() => (provider.isActive ? setConfirmingDeactivate(provider) : setActive(provider, true))}
                  >
                    {provider.isActive ? t('common.deactivate') : t('common.activate')}
                  </button>
                </td>
              </tr>
            ))}
            {data.providers.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  {t('providers.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmingDeactivate !== null}
        title={t('providers.confirmDeactivateTitle')}
        message={confirmingDeactivate ? t('providers.confirmDeactivateMessage', { name: confirmingDeactivate.name }) : ''}
        confirmLabel={t('common.deactivate')}
        danger
        busy={togglingId !== null}
        onConfirm={() => confirmingDeactivate && setActive(confirmingDeactivate, false)}
        onCancel={() => setConfirmingDeactivate(null)}
      />
    </div>
  );
}
