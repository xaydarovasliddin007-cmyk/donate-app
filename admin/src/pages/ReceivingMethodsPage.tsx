import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { ReceivingMethod } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';

export function ReceivingMethodsPage() {
  const { showError } = useToast();
  const { data, loading, error, reload } = useAsync(
    () => api.get<{ receivingMethods: ReceivingMethod[] }>('/admin/receiving-methods'),
    [],
  );

  const [cardNumberMasked, setCardNumberMasked] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createMethod(event: FormEvent) {
    event.preventDefault();
    if (!cardNumberMasked.trim() || !cardHolderName.trim()) {
      setFormError('Card number and holder name are required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/admin/receiving-methods', {
        cardNumberMasked: cardNumberMasked.trim(),
        cardHolderName: cardHolderName.trim(),
        bankName: bankName.trim() || undefined,
      });
      setCardNumberMasked('');
      setCardHolderName('');
      setBankName('');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create receiving method');
    } finally {
      setSubmitting(false);
    }
  }

  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleActive(method: ReceivingMethod) {
    setTogglingId(method.id);
    try {
      await api.patch(`/admin/receiving-methods/${method.id}`, { isActive: !method.isActive });
      reload();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Could not update receiving method');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <h1>Receiving methods</h1>
      <p className="muted">
        Cards shown to users for manual top-up transfers. There is no hardcoded card anywhere in the codebase —
        every card here is admin-configured.
      </p>

      <div className="panel">
        <h3>Add a receiving card</h3>
        <form className="stack-form" onSubmit={createMethod}>
          <div className="toolbar">
            <input
              placeholder="Masked card number (e.g. 8600 **** **** 1234)"
              value={cardNumberMasked}
              onChange={(e) => setCardNumberMasked(e.target.value)}
            />
            <input
              placeholder="Card holder name"
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value)}
            />
            <input placeholder="Bank name (optional)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add receiving method'}
          </button>
        </form>
      </div>

      {loading && <Loading />}
      {error && <p className="form-error">{error}</p>}
      {data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Holder</th>
              <th>Bank</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.receivingMethods.map((method) => (
              <tr key={method.id}>
                <td>{method.cardNumberMasked}</td>
                <td>{method.cardHolderName}</td>
                <td>{method.bankName ?? '—'}</td>
                <td>{method.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    disabled={togglingId === method.id}
                    onClick={() => toggleActive(method)}
                  >
                    {method.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {data.receivingMethods.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No receiving methods configured yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
