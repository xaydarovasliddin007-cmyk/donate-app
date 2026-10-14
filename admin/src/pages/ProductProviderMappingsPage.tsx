import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Product, Provider, ProviderProduct } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { ActiveBadge } from '../components/ActiveBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n/LocaleContext';
import { formatMinor } from '../lib/money';

const RETAIL_PRICE_STEP_MINOR = 10_000;

function estimateMargin(saleMinor: number, costMinor: number, feePercent: number, targetPercent: number) {
  const feeTenths = Math.round(feePercent * 10);
  const targetTenths = Math.round(targetPercent * 10);
  const remainingTenths = 1000 - feeTenths - targetTenths;
  if (remainingTenths <= 0) return null;

  const feeFor = (amount: number) => Math.ceil((amount * feeTenths) / 1000);
  const targetFor = (amount: number) => Math.ceil((amount * targetTenths) / 1000);
  const netMinor = saleMinor - feeFor(saleMinor) - costMinor;
  let targetSaleMinor = Math.ceil((costMinor * 1000) / remainingTenths / RETAIL_PRICE_STEP_MINOR) * RETAIL_PRICE_STEP_MINOR;
  while (targetSaleMinor - feeFor(targetSaleMinor) - costMinor < targetFor(targetSaleMinor)) {
    targetSaleMinor += RETAIL_PRICE_STEP_MINOR;
  }

  return {
    netMinor,
    netPercent: saleMinor > 0 ? (netMinor / saleMinor) * 100 : 0,
    targetSaleMinor,
  };
}

export function ProductProviderMappingsPage() {
  const { t } = useLocale();
  const { showError } = useToast();
  const { productId } = useParams<{ productId: string }>();

  const { data: productsData } = useAsync(() => api.get<{ products: Product[] }>('/admin/products'), []);
  const product = productsData?.products.find((p) => p.id === productId);

  const { data: providersData } = useAsync(() => api.get<{ providers: Provider[] }>('/admin/providers'), []);
  // Only TOPUP providers can fulfill a product/check a player's nickname —
  // PAYMENT providers (Payme, Click) are a different concern entirely.
  const topupProviders = providersData?.providers.filter((p) => p.type === 'TOPUP') ?? [];

  const { data, loading, error, reload } = useAsync(
    () => api.get<{ mappings: ProviderProduct[] }>(`/admin/products/${productId}/provider-mappings`),
    [productId],
  );

  const [providerId, setProviderId] = useState('');
  const [code, setCode] = useState('');
  const [priority, setPriority] = useState('0');
  const [cost, setCost] = useState('');
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [feePercent, setFeePercent] = useState(3);
  const [targetPercent, setTargetPercent] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<ProviderProduct | null>(null);

  async function createMapping(event: FormEvent) {
    event.preventDefault();
    if (!providerId || !code.trim()) {
      setFormError(t('providerMappings.fieldsRequired'));
      return;
    }
    const costMajor = cost.trim() === '' ? undefined : Number(cost);
    if (costMajor !== undefined && (!Number.isFinite(costMajor) || costMajor < 0)) {
      setFormError(t('providerMappings.invalidCost'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(`/admin/products/${productId}/provider-mappings`, {
        providerId,
        providerProductCode: code.trim(),
        costMinor: costMajor === undefined ? undefined : Math.round(costMajor * 100),
        priority: Number(priority) || 0,
      });
      setProviderId('');
      setCode('');
      setPriority('0');
      setCost('');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('providerMappings.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCost(mapping: ProviderProduct) {
    const draft = costDrafts[mapping.id] ?? (mapping.costMinor == null ? '' : String(mapping.costMinor / 100));
    const major = draft.trim() === '' ? null : Number(draft);
    if (major !== null && (!Number.isFinite(major) || major < 0)) {
      showError(t('providerMappings.invalidCost'));
      return;
    }
    setTogglingId(mapping.id);
    try {
      await api.patch(`/admin/provider-mappings/${mapping.id}`, {
        costMinor: major === null ? null : Math.round(major * 100),
      });
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('providerMappings.updateFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  async function setActive(mapping: ProviderProduct, isActive: boolean) {
    setTogglingId(mapping.id);
    try {
      await api.patch(`/admin/provider-mappings/${mapping.id}`, { isActive });
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('providerMappings.updateFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  async function removeMapping(mapping: ProviderProduct) {
    setTogglingId(mapping.id);
    try {
      await api.delete(`/admin/provider-mappings/${mapping.id}`);
      setConfirmingRemove(null);
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('providerMappings.removeFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: '0.5rem' }}>
        <Link to="/products">← {t('providerMappings.back')}</Link>
      </p>
      <h1>{t('providerMappings.title', { product: product?.name ?? '…' })}</h1>
      <p className="muted">{t('providerMappings.blurb')}</p>
      <p className="provider-health-note">{t('providerMappings.marginDisclaimer')}</p>

      <div className="toolbar" style={{ margin: '16px 0' }}>
        <label>
          {t('providerMappings.feePercent')}{' '}
          <input
            type="number"
            min="0"
            max="50"
            step="0.1"
            value={feePercent}
            onChange={(event) => setFeePercent(Number(event.target.value))}
            style={{ width: 86 }}
          />
          %
        </label>
        <label>
          {t('providerMappings.targetPercent')}{' '}
          <input
            type="number"
            min="0"
            max="50"
            step="0.1"
            value={targetPercent}
            onChange={(event) => setTargetPercent(Number(event.target.value))}
            style={{ width: 86 }}
          />
          %
        </label>
      </div>

      <div className="panel">
        <h3>{t('providerMappings.addMapping')}</h3>
        <form className="stack-form" onSubmit={createMapping}>
          <div className="toolbar">
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">{t('providerMappings.selectProvider')}</option>
              {topupProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            <input
              placeholder={t('providerMappings.codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t('providerMappings.costPlaceholder', { currency: product?.currency ?? 'UZS' })}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              style={{ width: 150 }}
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder={t('providerMappings.priorityPlaceholder')}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? t('providerMappings.adding') : t('providerMappings.addButton')}
          </button>
        </form>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('providerMappings.colProvider')}</th>
              <th>{t('providerMappings.colCode')}</th>
              <th>{t('providerMappings.colCost')}</th>
              <th>{t('providerMappings.colMargin')}</th>
              <th>{t('providerMappings.colPriority')}</th>
              <th>{t('providerMappings.colActive')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={7} />
          </tbody>
        </table>
      )}
      {error && <ErrorRetry error={error} onRetry={reload} />}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('providerMappings.colProvider')}</th>
              <th>{t('providerMappings.colCode')}</th>
              <th>{t('providerMappings.colCost')}</th>
              <th>{t('providerMappings.colMargin')}</th>
              <th>{t('providerMappings.colPriority')}</th>
              <th>{t('providerMappings.colActive')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>
                  {mapping.provider.name}
                  {!mapping.provider.isActive && (
                    <span className="badge badge-warning">{t('providerMappings.providerInactiveBadge')}</span>
                  )}
                </td>
                <td className="muted">{mapping.providerProductCode}</td>
                <td>
                  <div className="toolbar">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={t('providerMappings.colCost')}
                      value={costDrafts[mapping.id] ?? (mapping.costMinor == null ? '' : String(mapping.costMinor / 100))}
                      placeholder={mapping.costMinor == null ? t('providerMappings.unknownCost') : undefined}
                      onChange={(e) => setCostDrafts((current) => ({ ...current, [mapping.id]: e.target.value }))}
                      style={{ width: 120 }}
                    />
                    <button
                      className="btn btn-secondary"
                      disabled={togglingId === mapping.id}
                      onClick={() => saveCost(mapping)}
                    >
                      {t('common.save')}
                    </button>
                  </div>
                  {mapping.costMinor != null && (
                    <div className="muted">{formatMinor(mapping.costMinor, product?.currency ?? 'UZS')}</div>
                  )}
                </td>
                <td>
                  {mapping.costMinor == null || !product ? (
                    <span className="badge badge-warning">{t('providerMappings.marginUnknown')}</span>
                  ) : (
                    (() => {
                      const estimate = estimateMargin(product.amountMinor, mapping.costMinor, feePercent, targetPercent);
                      const quoteAge = mapping.priceUpdatedAt ? Date.now() - new Date(mapping.priceUpdatedAt).getTime() : Infinity;
                      const stale = quoteAge > 24 * 60 * 60 * 1000;
                      const belowTarget = !estimate || estimate.netPercent < targetPercent;
                      return (
                        <>
                          <span className={`badge ${stale || belowTarget ? 'badge-warning' : 'badge-success'}`}>
                            {estimate
                              ? `${formatMinor(estimate.netMinor, product.currency)} (${estimate.netPercent.toFixed(1)}%)`
                              : t('providerMappings.invalidTarget')}
                          </span>
                          {estimate && (
                            <div className="muted">
                              {t('providerMappings.targetPrice')}: {formatMinor(estimate.targetSaleMinor, product.currency)}
                            </div>
                          )}
                          {stale && <div className="muted">{t('providerMappings.priceStale')}</div>}
                        </>
                      );
                    })()
                  )}
                </td>
                <td>{mapping.priority}</td>
                <td>
                  <ActiveBadge active={mapping.isActive} />
                </td>
                <td>
                  <div className="toolbar">
                    <button
                      className="btn btn-secondary"
                      disabled={togglingId === mapping.id}
                      onClick={() => setActive(mapping, !mapping.isActive)}
                    >
                      {mapping.isActive ? t('common.deactivate') : t('common.activate')}
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={togglingId === mapping.id}
                      onClick={() => setConfirmingRemove(mapping)}
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.mappings.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {t('providerMappings.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmingRemove !== null}
        title={t('providerMappings.confirmRemoveTitle')}
        message={confirmingRemove ? t('providerMappings.confirmRemoveMessage', { name: confirmingRemove.provider.name }) : ''}
        confirmLabel={t('common.remove')}
        danger
        busy={togglingId !== null}
        onConfirm={() => confirmingRemove && removeMapping(confirmingRemove)}
        onCancel={() => setConfirmingRemove(null)}
      />
    </div>
  );
}
