import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Game, GameServer } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { ActiveBadge } from '../components/ActiveBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n/LocaleContext';

export function GameServersPage() {
  const { t } = useLocale();
  const { showError } = useToast();
  const { gameId } = useParams<{ gameId: string }>();

  const { data: gamesData } = useAsync(() => api.get<{ games: Game[] }>('/admin/games'), []);
  const game = gamesData?.games.find((g) => g.id === gameId);

  const { data, loading, error, reload } = useAsync(
    () => api.get<{ servers: GameServer[] }>(`/admin/games/${gameId}/servers`),
    [gameId],
  );

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<GameServer | null>(null);

  async function createServer(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !code.trim()) {
      setFormError(t('gameServers.fieldsRequired'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(`/admin/games/${gameId}/servers`, { name: name.trim(), code: code.trim() });
      setName('');
      setCode('');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('gameServers.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(server: GameServer, isActive: boolean) {
    setTogglingId(server.id);
    try {
      await api.patch(`/admin/game-servers/${server.id}`, { isActive });
      setConfirmingDeactivate(null);
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('gameServers.updateFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: '0.5rem' }}>
        <Link to="/games">← {t('gameServers.back')}</Link>
      </p>
      <h1>{t('gameServers.title', { game: game?.name ?? '…' })}</h1>

      <div className="panel">
        <h3>{t('gameServers.addServer')}</h3>
        <form className="stack-form" onSubmit={createServer}>
          <div className="toolbar">
            <input placeholder={t('gameServers.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder={t('gameServers.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? t('gameServers.adding') : t('gameServers.addButton')}
          </button>
        </form>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('gameServers.colName')}</th>
              <th>{t('gameServers.colCode')}</th>
              <th>{t('gameServers.colActive')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={4} />
          </tbody>
        </table>
      )}
      {error && <ErrorRetry error={error} onRetry={reload} />}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('gameServers.colName')}</th>
              <th>{t('gameServers.colCode')}</th>
              <th>{t('gameServers.colActive')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.servers.map((server) => (
              <tr key={server.id}>
                <td>{server.name}</td>
                <td className="muted">{server.code}</td>
                <td>
                  <ActiveBadge active={server.isActive} />
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    disabled={togglingId === server.id}
                    onClick={() => (server.isActive ? setConfirmingDeactivate(server) : setActive(server, true))}
                  >
                    {server.isActive ? t('common.deactivate') : t('common.activate')}
                  </button>
                </td>
              </tr>
            ))}
            {data.servers.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  {t('gameServers.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmingDeactivate !== null}
        title={t('gameServers.confirmDeactivateTitle')}
        message={confirmingDeactivate ? t('gameServers.confirmDeactivateMessage', { name: confirmingDeactivate.name }) : ''}
        confirmLabel={t('common.deactivate')}
        danger
        busy={togglingId !== null}
        onConfirm={() => confirmingDeactivate && setActive(confirmingDeactivate, false)}
        onCancel={() => setConfirmingDeactivate(null)}
      />
    </div>
  );
}
