import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { OrderStatus, OrderSummary, Product } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { downloadCsv } from '../lib/csv';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n/LocaleContext';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'];
// The server caps a single page at 100 — matches adminListOrdersQuerySchema's limit.
const EXPORT_LIMIT = 100;

export function OrdersPage() {
  const { t } = useLocale();
  const { showError } = useToast();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [gameId, setGameId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);

  // Reused only to populate the game filter dropdown — there's no dedicated
  // admin games-list endpoint, and products already carry their game.
  const { data: productsData } = useAsync(() => api.get<{ products: Product[] }>('/admin/products'), []);
  const games = useMemo(() => {
    const byId = new Map<string, string>();
    for (const product of productsData?.products ?? []) byId.set(product.game.id, product.game.name);
    return [...byId.entries()];
  }, [productsData]);

  const { data, loading, error, reload } = useAsync(
    () =>
      api.get<{ orders: OrderSummary[]; total: number }>('/admin/orders', {
        status: status || undefined,
        gameId: gameId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 50,
      }),
    [status, gameId, from, to],
  );

  async function exportCsv() {
    setExporting(true);
    try {
      const result = await api.get<{ orders: OrderSummary[] }>('/admin/orders', {
        status: status || undefined,
        gameId: gameId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: EXPORT_LIMIT,
      });
      downloadCsv(
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        result.orders.map((order) => ({
          orderNumber: order.orderNumber,
          user: order.user.displayName ?? order.user.email ?? order.user.phone ?? '',
          game: order.game.name,
          amount: formatMinor(order.amountMinor, order.currency),
          status: order.status,
          createdAt: order.createdAt,
        })),
      );
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('orders.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h1>{t('orders.title')}</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
          <option value="">{t('orders.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">{t('orders.allGames')}</option>
          {games.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="muted">{t('common.to')}</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-secondary" disabled={exporting || !data} onClick={exportCsv}>
          {t('common.exportCsv')}
        </button>
      </div>
      {data && data.total > EXPORT_LIMIT && (
        <p className="muted">{t('orders.exportTruncatedNote', { limit: EXPORT_LIMIT })}</p>
      )}

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('orders.colNumber')}</th>
              <th>{t('orders.colUser')}</th>
              <th>{t('orders.colGame')}</th>
              <th>{t('orders.colAmount')}</th>
              <th>{t('orders.colStatus')}</th>
              <th>{t('orders.colCreated')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={6} />
          </tbody>
        </table>
      )}
      {error && <ErrorRetry error={error} onRetry={reload} />}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('orders.colNumber')}</th>
              <th>{t('orders.colUser')}</th>
              <th>{t('orders.colGame')}</th>
              <th>{t('orders.colAmount')}</th>
              <th>{t('orders.colStatus')}</th>
              <th>{t('orders.colCreated')}</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link to={`/orders/${order.id}`}>{order.orderNumber}</Link>
                </td>
                <td>{order.user.displayName ?? order.user.email ?? order.user.phone ?? '—'}</td>
                <td>{order.game.name}</td>
                <td>{formatMinor(order.amountMinor, order.currency)}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>{formatDate(order.createdAt)}</td>
              </tr>
            ))}
            {data.orders.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('orders.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {data && <p className="muted">{t('orders.matching', { count: data.total })}</p>}
    </div>
  );
}
