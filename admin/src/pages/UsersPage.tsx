import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { UserListItem } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useLocale } from '../i18n/LocaleContext';

const PAGE_SIZE = 20;

export function UsersPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, loading, error, reload } = useAsync(
    () =>
      api.get<{ users: UserListItem[]; total: number }>('/admin/users', {
        search: committedSearch || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    [committedSearch, page],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <h1>{t('users.title')}</h1>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setCommittedSearch(search.trim());
        }}
      >
        <input
          placeholder={t('users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-secondary" type="submit">
          {t('users.search')}
        </button>
      </form>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('users.colId')}</th>
              <th>{t('users.colContact')}</th>
              <th>{t('users.colName')}</th>
              <th>{t('users.colRole')}</th>
              <th>{t('users.colStatus')}</th>
              <th>{t('users.colOrders')}</th>
              <th>{t('users.colJoined')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={7} />
          </tbody>
        </table>
      )}
      {error && <ErrorRetry error={error} onRetry={reload} />}
      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('users.colId')}</th>
                <th>{t('users.colContact')}</th>
                <th>{t('users.colName')}</th>
                <th>{t('users.colRole')}</th>
                <th>{t('users.colStatus')}</th>
                <th>{t('users.colOrders')}</th>
                <th>{t('users.colJoined')}</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link to={`/users/${user.id}`}>{user.publicId}</Link>
                  </td>
                  <td>{user.email ?? user.phone ?? '—'}</td>
                  <td>{user.displayName ?? '—'}</td>
                  <td>{user.role}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>{user._count.orders}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    {t('users.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="toolbar" style={{ marginTop: '1rem' }}>
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {t('common.previous')}
            </button>
            <span className="muted">
              {t('common.pageInfo', { page: page + 1, totalPages, total: data.total })}
            </span>
            <button
              className="btn btn-secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
