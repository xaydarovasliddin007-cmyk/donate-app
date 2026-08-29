import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Game, GameServer, Product } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatMinor } from '../lib/money';
import { useToast } from '../components/Toast';
import { ActiveBadge } from '../components/ActiveBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useLocale } from '../i18n/LocaleContext';

function ProductRow({
  product,
  onChanged,
  toggling,
  onRequestToggle,
}: {
  product: Product;
  onChanged: () => void;
  toggling: boolean;
  onRequestToggle: (product: Product) => void;
}) {
  const { t } = useLocale();
  const { showError } = useToast();
  const [amount, setAmount] = useState(String(product.amountMinor / 100));
  const [saving, setSaving] = useState(false);

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

  return (
    <tr>
      <td>{product.game.name}</td>
      <td className="muted">{product.server?.name ?? '—'}</td>
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
      <td>
        <ActiveBadge active={product.isActive} />
      </td>
      <td>
        <Link to={`/products/${product.id}/providers`}>{t('products.manageProviders')}</Link>
      </td>
      <td>
        <button className="btn btn-secondary" disabled={toggling} onClick={() => onRequestToggle(product)}>
          {product.isActive ? t('common.deactivate') : t('common.activate')}
        </button>
      </td>
    </tr>
  );
}

function CreateProductForm({ games, onCreated }: { games: Game[]; onCreated: () => void }) {
  const { t } = useLocale();
  const [gameId, setGameId] = useState('');
  const [serverId, setServerId] = useState('');
  const [servers, setServers] = useState<GameServer[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setServerId('');
    if (!gameId) {
      setServers([]);
      return;
    }
    // Only active servers belong in this picker — it's choosing where a new
    // product goes, and an inactive server (e.g. MLBB's old Asia/Europe/
    // Americas, replaced by real per-region servers) is invisible to
    // customers, so a product created under one would be unreachable.
    api
      .get<{ servers: GameServer[] }>(`/admin/games/${gameId}/servers`)
      .then((res) => setServers(res.servers.filter((s) => s.isActive)));
  }, [gameId]);

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    const amountMajor = Number(amount);
    if (!gameId || !name.trim() || !Number.isFinite(amountMajor) || amountMajor <= 0) {
      setFormError(t('products.fieldsRequired'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/admin/products', {
        gameId,
        serverId: serverId || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        amountMinor: Math.round(amountMajor * 100),
        currency,
      });
      setName('');
      setDescription('');
      setAmount('');
      onCreated();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('products.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <h3>{t('products.addProduct')}</h3>
      <form className="stack-form" onSubmit={createProduct}>
        <div className="toolbar">
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
            <option value="">{t('products.selectGame')}</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {servers.length > 0 && (
            <select value={serverId} onChange={(e) => setServerId(e.target.value)}>
              <option value="">{t('products.selectServer')}</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="toolbar">
          <input placeholder={t('products.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <input
            placeholder={t('products.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
        <div className="toolbar">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={t('products.amountPlaceholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 120 }}
          />
          <input
            placeholder={t('products.currencyPlaceholder')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            style={{ width: 80 }}
            maxLength={3}
          />
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? t('products.adding') : t('products.addButton')}
        </button>
      </form>
    </div>
  );
}

export function ProductsPage() {
  const { t } = useLocale();
  const { showError } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get<{ products: Product[] }>('/admin/products'), []);
  const { data: gamesData } = useAsync(() => api.get<{ games: Game[] }>('/admin/games'), []);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<Product | null>(null);

  async function setActive(product: Product, isActive: boolean) {
    setTogglingId(product.id);
    try {
      await api.patch(`/admin/products/${product.id}`, { isActive });
      setConfirmingDeactivate(null);
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('products.statusFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <h1>{t('products.title')}</h1>

      {gamesData && <CreateProductForm games={gamesData.games} onCreated={reload} />}

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('products.colGame')}</th>
              <th>{t('products.colServer')}</th>
              <th>{t('products.colProduct')}</th>
              <th>{t('products.colSetPrice')}</th>
              <th>{t('products.colCurrentPrice')}</th>
              <th>{t('products.colStatus')}</th>
              <th>{t('products.colFulfillment')}</th>
              <th></th>
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
              <th>{t('products.colGame')}</th>
              <th>{t('products.colServer')}</th>
              <th>{t('products.colProduct')}</th>
              <th>{t('products.colSetPrice')}</th>
              <th>{t('products.colCurrentPrice')}</th>
              <th>{t('products.colStatus')}</th>
              <th>{t('products.colFulfillment')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onChanged={reload}
                toggling={togglingId === product.id}
                onRequestToggle={(p) => (p.isActive ? setConfirmingDeactivate(p) : setActive(p, true))}
              />
            ))}
            {data.products.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {t('products.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmingDeactivate !== null}
        title={t('products.confirmDeactivateTitle')}
        message={confirmingDeactivate ? t('products.confirmDeactivateMessage', { name: confirmingDeactivate.name }) : ''}
        confirmLabel={t('common.deactivate')}
        danger
        busy={togglingId !== null}
        onConfirm={() => confirmingDeactivate && setActive(confirmingDeactivate, false)}
        onCancel={() => setConfirmingDeactivate(null)}
      />
    </div>
  );
}
