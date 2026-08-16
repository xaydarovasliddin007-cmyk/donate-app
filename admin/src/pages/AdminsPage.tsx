import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { AdminRole, AdminUserRow } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/money';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

const ROLES: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'FINANCE', 'CONTENT_MANAGER'];

export function AdminsPage() {
  const { t } = useLocale();
  const { admin: currentAdmin } = useAuth();
  const { showError } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get<{ admins: AdminUserRow[] }>('/admin/admins'), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminRole>('SUPPORT');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createAdmin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || password.length < 8 || !fullName.trim()) {
      setFormError(t('admins.fieldsRequired'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/admin/admins', { email: email.trim(), password, fullName: fullName.trim(), role });
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('SUPPORT');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('admins.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const [confirmingDeactivate, setConfirmingDeactivate] = useState<AdminUserRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function setActive(target: AdminUserRow, isActive: boolean) {
    setTogglingId(target.id);
    try {
      await api.patch(`/admin/admins/${target.id}`, { isActive });
      setConfirmingDeactivate(null);
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('admins.statusFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  async function changeRole(target: AdminUserRow, newRole: AdminRole) {
    try {
      await api.patch(`/admin/admins/${target.id}`, { role: newRole });
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('admins.roleFailed'));
      reload();
    }
  }

  return (
    <div>
      <h1>{t('admins.title')}</h1>
      <p className="muted">{t('admins.blurb')}</p>

      <div className="panel">
        <h3>{t('admins.addAdmin')}</h3>
        <form className="stack-form" onSubmit={createAdmin}>
          <div className="toolbar">
            <input placeholder={t('admins.emailPlaceholder')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              placeholder={t('admins.passwordPlaceholder')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input placeholder={t('admins.fullNamePlaceholder')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? t('admins.adding') : t('admins.addButton')}
          </button>
        </form>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('admins.colEmail')}</th>
              <th>{t('admins.colFullName')}</th>
              <th>{t('admins.colRole')}</th>
              <th>{t('admins.colStatus')}</th>
              <th>{t('admins.colCreated')}</th>
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
              <th>{t('admins.colEmail')}</th>
              <th>{t('admins.colFullName')}</th>
              <th>{t('admins.colRole')}</th>
              <th>{t('admins.colStatus')}</th>
              <th>{t('admins.colCreated')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.admins.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>{row.fullName}</td>
                <td>
                  <select value={row.role} onChange={(e) => changeRole(row, e.target.value as AdminRole)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{row.isActive ? t('common.active') : t('common.inactive')}</td>
                <td>{formatDate(row.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    disabled={row.id === currentAdmin?.id && row.isActive}
                    title={row.id === currentAdmin?.id && row.isActive ? t('admins.cannotDeactivateSelf') : undefined}
                    onClick={() => (row.isActive ? setConfirmingDeactivate(row) : setActive(row, true))}
                  >
                    {row.isActive ? t('common.deactivate') : t('common.activate')}
                  </button>
                </td>
              </tr>
            ))}
            {data.admins.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('admins.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmingDeactivate !== null}
        title={t('admins.confirmDeactivateTitle')}
        message={
          confirmingDeactivate
            ? t('admins.confirmDeactivateMessage', { name: confirmingDeactivate.fullName, email: confirmingDeactivate.email })
            : ''
        }
        confirmLabel={t('admins.deactivateButton')}
        danger
        busy={togglingId !== null}
        onConfirm={() => confirmingDeactivate && setActive(confirmingDeactivate, false)}
        onCancel={() => setConfirmingDeactivate(null)}
      />
    </div>
  );
}
