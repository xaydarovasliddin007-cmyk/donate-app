import { useState } from 'react';
import { api } from '../api/client';
import type { Stats, StatsRangePreset } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatMinor, formatDate } from '../lib/money';
import { BreakdownChart } from '../components/BreakdownChart';
import { Loading } from '../components/Loading';

const RANGE_LABELS: Record<StatsRangePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  custom: 'Custom',
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
      <h1>Dashboard</h1>
      <div className="toolbar">
        {(Object.keys(RANGE_LABELS) as StatsRangePreset[]).map((preset) => (
          <button
            key={preset}
            className={`btn ${range === preset ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRange(preset)}
          >
            {RANGE_LABELS[preset]}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="muted">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      {loading && <Loading />}
      {error && !data && (
        <div className="panel">
          <p className="form-error">{error}</p>
          <button className="btn btn-secondary" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {data && (
        <>
          <p className="muted">
            Showing {formatDate(data.range.from)} – {formatDate(data.range.to)}
          </p>
          <div className="stat-grid">
            <StatCard label="Total users" value={data.totalUsers} />
            <StatCard label="New users in range" value={data.newUsersInRange} />
            <StatCard label="Orders in range" value={data.ordersInRange} />
            <StatCard
              label="Wallet liability"
              value={
                Object.entries(data.walletLiabilityByCurrency)
                  .map(([currency, amount]) => formatMinor(amount, currency))
                  .join(', ') || '—'
              }
            />
          </div>
          <div className="panel-grid">
            <BreakdownChart
              title="Users by status"
              rows={Object.entries(data.usersByStatus).map(([label, value]) => ({ label, value }))}
            />
            <BreakdownChart
              title="Orders by status"
              rows={Object.entries(data.ordersByStatus).map(([label, value]) => ({ label, value }))}
            />
            <BreakdownChart
              title="Top-ups by status"
              rows={Object.entries(data.topUpsByStatus).map(([label, value]) => ({ label, value }))}
            />
            <BreakdownChart
              title="Revenue in range (completed orders)"
              rows={Object.entries(data.revenueInRangeByCurrency).map(([currency, amount]) => ({
                label: currency,
                value: amount,
                displayValue: formatMinor(amount, currency),
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
