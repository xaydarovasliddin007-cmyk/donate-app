import { api } from '../api/client';
import type { Provider } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { Loading } from '../components/Loading';

function successRateLabel(rate: number | null): string {
  if (rate === null) return 'No attempts yet';
  return `${(rate * 100).toFixed(1)}%`;
}

export function ProvidersPage() {
  const { data, loading, error } = useAsync(() => api.get<{ providers: Provider[] }>('/admin/providers'), []);

  return (
    <div>
      <h1>Providers</h1>
      <p className="muted">
        Payment and top-up/fulfillment providers configured in this environment. Only development/mock adapters
        exist until a real provider is integrated — see the production checklist in the repo docs.
      </p>
      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Active</th>
              <th>Health</th>
              <th>Success rate</th>
              <th>Attempts</th>
              <th>Last checked</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.code}</td>
                <td>{provider.name}</td>
                <td>{provider.type}</td>
                <td>{provider.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <StatusBadge status={provider.healthStatus} />
                </td>
                <td>{successRateLabel(provider.successRate)}</td>
                <td className="muted">
                  {provider.succeededAttempts} ok / {provider.failedAttempts} failed / {provider.totalAttempts} total
                </td>
                <td>{provider.lastCheckedAt ? formatDate(provider.lastCheckedAt) : '—'}</td>
              </tr>
            ))}
            {data.providers.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No providers configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
