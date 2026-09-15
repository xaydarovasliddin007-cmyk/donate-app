import { useState } from 'react';
import { api } from '../api/client';
import type { Stats, StatsRangePreset } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatMinor, formatDate } from '../lib/money';
import { BreakdownChart } from '../components/BreakdownChart';
import { Loading } from '../components/Loading';
import { useLocale } from '../i18n/LocaleContext';

const RANGE_KEYS: Record<StatsRangePreset, string> = {
  today: 'dashboard.rangeToday',
  '7d': 'dashboard.range7d',
  '30d': 'dashboard.range30d',
  '90d': 'dashboard.range90d',
  custom: 'dashboard.rangeCustom',
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useLocale();
  const [range, setRange] = useState<StatsRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data, loading, error, reload } = useAsync(
    () =>
      api.get<Stats>('/admin/stats', {
        range,
        from: range === 'custom' && customFrom ? customFrom : undefined,
        to: range === 'custom' && customTo ? customTo : undefined,
      }),
    [range, range === 'custom' ? customFrom : null, range === 'custom' ? customTo : null],
  );

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <div className="toolbar">
        {(Object.keys(RANGE_KEYS) as StatsRangePreset[]).map((preset) => (
          <button
            key={preset}
            className={`btn ${range === preset ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRange(preset)}
          >
            {t(RANGE_KEYS[preset])}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="muted">{t('common.to')}</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      {loading && <Loading />}
      {error && !data && (
        <div className="panel">
          <p className="form-error">{error}</p>
          <button className="btn btn-secondary" onClick={reload}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {data && (
        <>
          <p className="muted">{t('dashboard.showing', { from: formatDate(data.range.from), to: formatDate(data.range.to) })}</p>
          <div className="stat-grid">
            <StatCard label={t('dashboard.totalUsers')} value={data.totalUsers} />
            <StatCard label={t('dashboard.newUsers')} value={data.newUsersInRange} />
            <StatCard label={t('dashboard.ordersInRange')} value={data.ordersInRange} />
            <StatCard
              label={t('dashboard.walletLiability')}
              value={
                Object.entries(data.walletLiabilityByCurrency)
                  .map(([currency, amount]) => formatMinor(amount, currency))
                  .join(', ') || '—'
              }
            />
            <StatCard label={t('dashboard.profitInRange')} value={formatMinor(data.profitInRangeMinor, 'UZS')} />
          </div>
          {data.profitCostUnknownItemCount > 0 && (
            <p className="muted">{t('dashboard.profitIncomplete', { count: data.profitCostUnknownItemCount })}</p>
          )}
          <div className="panel-grid">
            <BreakdownChart
              title={t('dashboard.usersByStatus')}
              rows={Object.entries(data.usersByStatus).map(([label, value]) => ({ label, value }))}
            />
            <BreakdownChart
              title={t('dashboard.ordersByStatus')}
              rows={Object.entries(data.ordersByStatus).map(([label, value]) => ({ label, value }))}
            />
            <BreakdownChart
              title={t('dashboard.topUpsByStatus')}
              rows={Object.entries(data.topUpsByStatus).map(([label, value]) => ({ label, value }))}
            />
            <BreakdownChart
              title={t('dashboard.revenueInRange')}
              rows={Object.entries(data.revenueInRangeByCurrency).map(([currency, amount]) => ({
                label: currency,
                value: amount,
                displayValue: formatMinor(amount, currency),
              }))}
            />
          </div>
          <div className="panel-grid">
            <div className="panel">
              <h3>{t('dashboard.topClients')}</h3>
              {data.topClients.length === 0 ? (
                <p className="muted">{t('dashboard.topClientsEmpty')}</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.colClient')}</th>
                      <th>{t('dashboard.colOrders')}</th>
                      <th>{t('dashboard.colSpent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClients.map((row, i) => (
                      <tr key={`${row.user?.id ?? i}-${row.currency}`}>
                        <td>{row.user?.displayName ?? row.user?.email ?? row.user?.publicId ?? '—'}</td>
                        <td>{row.orderCount}</td>
                        <td>{formatMinor(row.totalSpentMinor, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="panel">
              <h3>{t('dashboard.topGames')}</h3>
              {data.topGames.length === 0 ? (
                <p className="muted">{t('dashboard.topGamesEmpty')}</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.colGame')}</th>
                      <th>{t('dashboard.colOrders')}</th>
                      <th>{t('dashboard.colRevenue')}</th>
                      <th>{t('dashboard.colProfit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topGames.map((row, i) => (
                      <tr key={`${row.game?.id ?? i}-${row.currency}`}>
                        <td>{row.game?.name ?? '—'}</td>
                        <td>{row.orderCount}</td>
                        <td>{formatMinor(row.revenueMinor, row.currency)}</td>
                        <td>{row.profitMinor == null ? '-' : formatMinor(row.profitMinor, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
