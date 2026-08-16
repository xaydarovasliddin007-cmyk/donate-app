import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { UserListItem } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { Loading } from '../components/Loading';

const PAGE_SIZE = 20;

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, loading, error } = useAsync(
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
      <h1>Users</h1>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setCommittedSearch(search.trim());
        }}
      >
        <input
          placeholder="Search by UZDONATE ID, email, phone, or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>UZDONATE ID</th>
                <th>Contact</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Joined</th>
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
                  <td>{user.status}</td>
                  <td>{user._count.orders}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="toolbar" style={{ marginTop: '1rem' }}>
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="muted">
              Page {page + 1} of {totalPages} ({data.total} total)
            </span>
            <button
              className="btn btn-secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
