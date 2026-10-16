import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiError } from '../api/client';
import type { TopUpRequestAdmin, TopUpRequestStatus } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { formatDate, formatMinor, parseTopUpAmount } from '../lib/money';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/SkeletonRows';
import { ErrorRetry } from '../components/ErrorRetry';
import { useLocale } from '../i18n/LocaleContext';

const STATUSES: TopUpRequestStatus[] = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'];

function ReceiptButton({ request }: { request: TopUpRequestAdmin }) {
  const { t } = useLocale();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!request.receipt) return null;
  async function open() {
    setBusy(true); setError('');
    try { setUrl(URL.createObjectURL(await api.blob(`/admin/topups/${request.id}/receipt`))); }
    catch { setError(t('topups.receiptFailed')); }
    finally { setBusy(false); }
  }
  return <div>
    <button className="btn btn-secondary" disabled={busy} onClick={open}>{busy ? t('common.loading') : t('topups.viewReceipt')}</button>
    {error && <div className="form-error" role="alert">{error}</div>}
    {url && createPortal(<div className="modal-backdrop" onClick={() => setUrl('')}><div className="modal" role="dialog" aria-modal="true" aria-label={t('topups.viewReceipt')} onClick={event => event.stopPropagation()}>
      <h3>{t('topups.viewReceipt')}</h3><img src={url} alt={t('topups.receiptImage')} style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain' }}/>
      <button className="btn btn-secondary" onClick={() => setUrl('')}>{t('topups.cancel')}</button>
    </div></div>, document.body)}
  </div>;
}

function typeLabel(t: (key: string) => string, type: TopUpRequestAdmin['type']) {
  switch (type) {
    case 'QR_CODE':
      return t('receivingMethods.typeQrCode');
    case 'PAYNET_TERMINAL':
      return t('receivingMethods.typeBankomat');
    case 'CARD_TRANSFER':
      return t('receivingMethods.typeCardTransfer');
    default:
      return '—';
  }
}

function TopUpRow({ request, onChanged }: { request: TopUpRequestAdmin; onChanged: () => void }) {
  const { t } = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amount, setAmount] = useState(String(request.amountMinor / 100));
  const [reviewNote, setReviewNote] = useState('');
  const [confirmation, setConfirmation] = useState<number | null>(null);
  const mutation = useRef(false);

  function prepareVerify() {
    const confirmed = editingAmount ? parseTopUpAmount(amount) : request.amountMinor;
    if (confirmed === null) { setRowError(t('topups.invalidAmount')); return; }
    if (confirmed !== request.amountMinor && !reviewNote.trim()) { setRowError(t('topups.amountReasonRequired')); return; }
    setRowError(null); setConfirmation(confirmed);
  }

  async function verify() {
    if (mutation.current || confirmation === null) return;
    mutation.current = true;
    setBusy(true);
    setRowError(null);
    try {
      await api.post(`/admin/topups/${request.id}/verify`, editingAmount ? { amountMinor: confirmation, reviewNote: reviewNote.trim() || undefined } : undefined);
      setConfirmation(null);
      setEditingAmount(false); setReviewNote('');
      onChanged();
    } catch (err) {
      setConfirmation(null);
      setRowError(err instanceof ApiError ? err.message : t('topups.verifyFailed'));
    } finally {
      setBusy(false);
      mutation.current = false;
    }
  }

  async function reject() {
    if (mutation.current) return;
    if (!reason.trim()) {
      setRowError(t('topups.reasonRequired'));
      return;
    }
    mutation.current = true; setBusy(true);
    setRowError(null);
    try {
      await api.post(`/admin/topups/${request.id}/reject`, { rejectionReason: reason.trim() });
      onChanged();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : t('topups.rejectFailed'));
    } finally {
      setBusy(false);
      mutation.current = false;
    }
  }

  return (
    <tr>
      <td>{request.user.displayName ?? request.user.email ?? request.user.phone ?? request.user.publicId}</td>
      <td>{typeLabel(t, request.type)}</td>
      <td>{formatMinor(request.amountMinor, request.currency)}
        {editingAmount && <div className="stack-form">
          <label>{t('topups.actualAmount')}<input aria-label={t('topups.actualAmount')} inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)}/></label>
          <label>{t('topups.amountReason')}<input aria-label={t('topups.amountReason')} maxLength={500} value={reviewNote} disabled={busy} onChange={event => setReviewNote(event.target.value)}/></label>
        </div>}
      </td>
      <td>
        {request.receivingMethod ? (
          <>
            {request.receivingMethod.cardHolderName}
            {request.receivingMethod.cardNumber && (
              <>
                <br />
                <span className="muted">{request.receivingMethod.cardNumber}</span>
              </>
            )}
          </>
        ) : (
          <span className="muted">{t('topups.methodNotYetMatched')}</span>
        )}
      </td>
      <td className="muted">{request.userReference ?? '—'}<ReceiptButton request={request}/></td>
      <td>
        <StatusBadge status={request.status} />
        {request.status === 'PENDING' && request.userConfirmedPaidAt && (
          <div className="badge badge-warning" style={{ marginTop: 4 }}>
            {t('topups.userConfirmedPaid')}
          </div>
        )}
        {request.rejectionReason && <div className="muted">{request.rejectionReason}</div>}
      </td>
      <td>{formatDate(request.createdAt)}</td>
      <td>
        {(request.status === 'PENDING' || request.status === 'EXPIRED') && (
          <div className="stack-form">
            {request.status === 'EXPIRED' && (
              <div className="muted">{t('topups.expiredButVerifiableNote')}</div>
            )}
            {rowError && <div className="form-error" role="alert">{rowError}</div>}
            {!rejecting ? (
              <div className="toolbar">
                <button className="btn btn-primary" disabled={busy} onClick={prepareVerify}>
                  {t('topups.verify')}
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => { setEditingAmount(value => !value); setAmount(String(request.amountMinor / 100)); setReviewNote(''); setRowError(null); }}>{editingAmount ? t('topups.cancelAmount') : t('topups.otherAmount')}</button>
                {(request.status === 'PENDING' || request.status === 'EXPIRED') && (
                  <button className="btn btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
                    {t('topups.reject')}
                  </button>
                )}
              </div>
            ) : (
              <div className="toolbar">
                <input
                  placeholder={t('topups.rejectionPlaceholder')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button className="btn btn-danger" disabled={busy} onClick={reject}>
                  {t('topups.confirmReject')}
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setRejecting(false)}>
                  {t('topups.cancel')}
                </button>
              </div>
            )}
          </div>
        )}
        <ConfirmDialog open={confirmation !== null} title={t('topups.verify')} message={t('topups.creditConfirmation').replace('{amount}', formatMinor(confirmation ?? request.amountMinor, request.currency))} busy={busy} onConfirm={verify} onCancel={() => { if (!busy) setConfirmation(null); }}/>
      </td>
    </tr>
  );
}

export function TopUpsPage() {
  const { t } = useLocale();
  const [botUsername, setBotUsername] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState('');
  async function showReviewBot() {
    setBotLoading(true); setBotError('');
    try { setBotUsername((await api.get<{ username: string }>('/admin/topups/review-bot')).username); }
    catch { setBotError(t('topups.botFailed')); }
    finally { setBotLoading(false); }
  }
  const [status, setStatus] = useState<TopUpRequestStatus | ''>('PENDING');
  const { data, loading, error, reload } = useAsync(
    () => api.get<{ topUps: TopUpRequestAdmin[] }>('/admin/topups', { status: status || undefined, limit: 50 }),
    [status],
  );

  return (
    <div>
      <h1>{t('topups.title')}</h1>
      <p className="muted">{t('topups.blurb')}</p>
      <div className="toolbar">
        <button className="btn btn-secondary" disabled={botLoading} onClick={showReviewBot}>{t('topups.reviewBot')}</button>
        <select value={status} onChange={(e) => setStatus(e.target.value as TopUpRequestStatus | '')}>
          <option value="">{t('orders.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {botUsername && <p className="muted"><a href={`https://t.me/${encodeURIComponent(botUsername)}`} target="_blank" rel="noreferrer">@{botUsername}</a> — {t('topups.botSetupHint')}</p>}
      {botError && <p className="form-error" role="alert">{botError}</p>}

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('topups.colUser')}</th>
              <th>{t('topups.colType')}</th>
              <th>{t('topups.colAmount')}</th>
              <th>{t('topups.colMethod')}</th>
              <th>{t('topups.colReference')}</th>
              <th>{t('topups.colStatus')}</th>
              <th>{t('topups.colRequested')}</th>
              <th>{t('topups.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={8} />
          </tbody>
        </table>
      )}
      {error && <ErrorRetry error={error} onRetry={reload} />}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('topups.colUser')}</th>
              <th>{t('topups.colType')}</th>
              <th>{t('topups.colAmount')}</th>
              <th>{t('topups.colMethod')}</th>
              <th>{t('topups.colReference')}</th>
              <th>{t('topups.colStatus')}</th>
              <th>{t('topups.colRequested')}</th>
              <th>{t('topups.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.topUps.map((request) => (
              <TopUpRow key={request.id} request={request} onChanged={reload} />
            ))}
            {data.topUps.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {t('topups.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
