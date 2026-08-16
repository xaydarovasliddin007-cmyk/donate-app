import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Product } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatMinor } from '../lib/money';
import { useToast } from '../components/Toast';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const { t } = useLocale();
  const { showError } = useToast();
  const [amount, setAmount] = useState(String(product.amountMinor / 100));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function saveAmount() {
    const amountMajor = Number(amount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) return;
    setSaving(true);
    try {
      await api.patch(`/admin/products/${product.id}`, { amountMinor: Math.round(amountMajor * 100) });
      onChanged();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('products.priceFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      await api.patch(`/admin/products/${product.id}`, { isActive: !product.isActive });
      onChanged();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('products.statusFailed'));
    } finally {
      setToggling(false);
    }
  }

  return (
    <tr>
      <td>{product.game.name}</td>
      <td>
        {product.name}
        {product.isTest && <span className="badge badge-warning">{t('products.testBadge')}</span>}
      </td>
      <td>
        <div className="toolbar">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 100 }}
          />
          <span className="muted">{product.currency}</span>
          <button className="btn btn-secondary" disabled={saving} onClick={saveAmount}>
            {t('common.save')}
          </button>
        </div>
      </td>
      <td>{formatMinor(product.amountMinor, product.currency)}</td>
      <td>{product.isActive ? t('common.active') : t('common.inactive')}</td>
      <td>
        <button className="btn btn-secondary" disabled={toggling} onClick={toggleActive}>
          {product.isActive ? t('common.deactivate') : t('common.activate')}
        </button>
      </td>
    </tr>
  );
}

export function ProductsPage() {
  const { t } = useLocale();
  const { data, loading, error, reload } = useAsync(() => api.get<{ products: Product[] }>('/admin/products'), []);

  return (
    <div>
      <h1>{t('products.title')}</h1>
      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('products.colGame')}</th>
              <th>{t('products.colProduct')}</th>
              <th>{t('products.colSetPrice')}</th>
              <th>{t('products.colCurrentPrice')}</th>
              <th>{t('products.colStatus')}</th>
              <th></th>
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
              <th>{t('products.colGame')}</th>
              <th>{t('products.colProduct')}</th>
              <th>{t('products.colSetPrice')}</th>
              <th>{t('products.colCurrentPrice')}</th>
              <th>{t('products.colStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((product) => (
              <ProductRow key={product.id} product={product} onChanged={reload} />
            ))}
            {data.products.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('products.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
