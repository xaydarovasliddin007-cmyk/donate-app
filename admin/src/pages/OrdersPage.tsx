import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { OrderStatus, OrderSummary, Product } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'FULFILLING', 'COMPLETED', 'FAILED', 'REFUNDED'];

export function OrdersPage() {
  const { t } = useLocale();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [gameId, setGameId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Reused only to populate the game filter dropdown — there's no dedicated
  // admin games-list endpoint, and products already carry their game.
  const { data: productsData } = useAsync(() => api.get<{ products: Product[] }>('/admin/products'), []);
  const games = useMemo(() => {
    const byId = new Map<string, string>();
    for (const product of productsData?.products ?? []) byId.set(product.game.id, product.game.name);
    return [...byId.entries()];
  }, [productsData]);

  const { data, loading, error } = useAsync(
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
      </div>

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
      {error && <p className="form-error">{error}</p>}
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
