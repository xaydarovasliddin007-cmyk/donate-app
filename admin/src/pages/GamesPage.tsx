import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Game, GameAvailability } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useLocale } from '../i18n/LocaleContext';

const AVAILABILITY_VALUES: GameAvailability[] = ['ACTIVE', 'COMING_SOON', 'DISABLED'];

function availabilityLabelKey(value: GameAvailability): string {
  return { ACTIVE: 'games.availabilityActive', COMING_SOON: 'games.availabilityComingSoon', DISABLED: 'games.availabilityDisabled' }[
    value
  ];
}

export function GamesPage() {
  const { t } = useLocale();
  const { data, loading, error, reload } = useAsync(() => api.get<{ games: Game[] }>('/admin/games'), []);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [availability, setAvailability] = useState<GameAvailability>('COMING_SOON');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createGame(event: FormEvent) {
    event.preventDefault();
    if (!slug.trim() || !name.trim()) {
      setFormError(t('games.fieldsRequired'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/admin/games', {
        slug: slug.trim(),
        name: name.trim(),
        category: category.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        availability,
      });
      setSlug('');
      setName('');
      setCategory('');
      setLogoUrl('');
      setAvailability('COMING_SOON');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('games.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeAvailability(game: Game, next: GameAvailability) {
    try {
      await api.patch(`/admin/games/${game.id}`, { availability: next });
      reload();
    } catch {
      reload();
    }
  }

  return (
    <div>
      <h1>{t('games.title')}</h1>
      <p className="muted">{t('games.blurb')}</p>

      <div className="panel">
        <h3>{t('games.addGame')}</h3>
        <form className="stack-form" onSubmit={createGame}>
          <div className="toolbar">
            <input placeholder={t('games.slugPlaceholder')} value={slug} onChange={(e) => setSlug(e.target.value)} />
            <input placeholder={t('games.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            <input
              placeholder={t('games.categoryPlaceholder')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="toolbar">
            <input
              placeholder={t('games.logoUrlPlaceholder')}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
            />
            <select value={availability} onChange={(e) => setAvailability(e.target.value as GameAvailability)}>
              {AVAILABILITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t(availabilityLabelKey(v))}
                </option>
              ))}
            </select>
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? t('games.adding') : t('games.addButton')}
          </button>
        </form>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('games.colName')}</th>
              <th>{t('games.colCategory')}</th>
              <th>{t('games.colAvailability')}</th>
              <th>{t('games.colProducts')}</th>
              <th>{t('games.colServers')}</th>
              <th></th>
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
              <th>{t('games.colName')}</th>
              <th>{t('games.colCategory')}</th>
              <th>{t('games.colAvailability')}</th>
              <th>{t('games.colProducts')}</th>
              <th>{t('games.colServers')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.games.map((game) => (
              <tr key={game.id}>
                <td>
                  {game.logoUrl && (
                    <img
                      src={game.logoUrl}
                      alt=""
                      width={24}
                      height={24}
                      style={{ borderRadius: 6, marginRight: 8, verticalAlign: 'middle' }}
                    />
                  )}
                  {game.name}
                </td>
                <td className="muted">{game.category ?? '—'}</td>
                <td>
                  <select value={game.availability} onChange={(e) => changeAvailability(game, e.target.value as GameAvailability)}>
                    {AVAILABILITY_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {t(availabilityLabelKey(v))}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{game._count.products}</td>
                <td>{game._count.servers}</td>
                <td>
                  <Link className="btn btn-secondary" to={`/games/${game.id}/servers`}>
                    {t('games.manageServers')}
                  </Link>
                </td>
              </tr>
            ))}
            {data.games.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('games.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
