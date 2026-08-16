import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Product } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatMinor } from '../lib/money';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
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
      showError(err instanceof ApiError ? err.message : 'Could not update price');
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
      showError(err instanceof ApiError ? err.message : 'Could not update product status');
    } finally {
      setToggling(false);
    }
  }

  return (
    <tr>
      <td>{product.game.name}</td>
      <td>
        {product.name}
        {product.isTest && <span className="badge badge-warning">TEST</span>}
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
            Save
          </button>
        </div>
      </td>
      <td>{formatMinor(product.amountMinor, product.currency)}</td>
      <td>{product.isActive ? 'Active' : 'Inactive'}</td>
      <td>
        <button className="btn btn-secondary" disabled={toggling} onClick={toggleActive}>
          {product.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  );
}

export function ProductsPage() {
  const { data, loading, error, reload } = useAsync(() => api.get<{ products: Product[] }>('/admin/products'), []);

  return (
    <div>
      <h1>Products</h1>
      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Product</th>
              <th>Set price</th>
              <th>Current price</th>
              <th>Status</th>
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
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
