import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { ReceivingMethod } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { useToast } from '../components/Toast';
import { ActiveBadge } from '../components/ActiveBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SkeletonRows } from '../components/SkeletonRows';
import { useLocale } from '../i18n/LocaleContext';

export function ReceivingMethodsPage() {
  const { t } = useLocale();
  const { showError } = useToast();
  const { data, loading, error, reload } = useAsync(
    () => api.get<{ receivingMethods: ReceivingMethod[] }>('/admin/receiving-methods'),
    [],
  );

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createMethod(event: FormEvent) {
    event.preventDefault();
    if (!cardNumber.trim() || !cardHolderName.trim()) {
      setFormError(t('receivingMethods.fieldsRequired'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/admin/receiving-methods', {
        cardNumber: cardNumber.trim(),
        cardHolderName: cardHolderName.trim(),
        bankName: bankName.trim() || undefined,
      });
      setCardNumber('');
      setCardHolderName('');
      setBankName('');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('receivingMethods.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<ReceivingMethod | null>(null);

  async function setActive(method: ReceivingMethod, isActive: boolean) {
    setTogglingId(method.id);
    try {
      await api.patch(`/admin/receiving-methods/${method.id}`, { isActive });
      setConfirmingDeactivate(null);
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t('receivingMethods.updateFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <h1>{t('receivingMethods.title')}</h1>
      <p className="muted">{t('receivingMethods.blurb')}</p>

      <div className="panel">
        <h3>{t('receivingMethods.addCard')}</h3>
        <form className="stack-form" onSubmit={createMethod}>
          <div className="toolbar">
            <input
              placeholder={t('receivingMethods.cardNumberPlaceholder')}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
            />
            <input
              placeholder={t('receivingMethods.cardHolderPlaceholder')}
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value)}
            />
            <input
              placeholder={t('receivingMethods.bankPlaceholder')}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? t('receivingMethods.adding') : t('receivingMethods.addMethod')}
          </button>
        </form>
      </div>

      {loading && !data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('receivingMethods.colCard')}</th>
              <th>{t('receivingMethods.colHolder')}</th>
              <th>{t('receivingMethods.colBank')}</th>
              <th>{t('receivingMethods.colActive')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={5} />
          </tbody>
        </table>
      )}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('receivingMethods.colCard')}</th>
              <th>{t('receivingMethods.colHolder')}</th>
              <th>{t('receivingMethods.colBank')}</th>
              <th>{t('receivingMethods.colActive')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.receivingMethods.map((method) => (
              <tr key={method.id}>
                <td>{method.cardNumber}</td>
                <td>{method.cardHolderName}</td>
                <td>{method.bankName ?? '—'}</td>
                <td>
                  <ActiveBadge active={method.isActive} />
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    disabled={togglingId === method.id}
                    onClick={() => (method.isActive ? setConfirmingDeactivate(method) : setActive(method, true))}
                  >
                    {method.isActive ? t('common.deactivate') : t('common.activate')}
                  </button>
                </td>
              </tr>
            ))}
            {data.receivingMethods.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  {t('receivingMethods.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmingDeactivate !== null}
        title={t('receivingMethods.confirmDeactivateTitle')}
        message={
          confirmingDeactivate
            ? t('receivingMethods.confirmDeactivateMessage', { card: confirmingDeactivate.cardNumber })
            : ''
        }
        confirmLabel={t('common.deactivate')}
        danger
        busy={togglingId !== null}
        onConfirm={() => confirmingDeactivate && setActive(confirmingDeactivate, false)}
        onCancel={() => setConfirmingDeactivate(null)}
      />
    </div>
  );
}
