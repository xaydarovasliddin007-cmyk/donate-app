import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, CreditCard, LoaderCircle } from 'lucide-react';
import type { ReceivingMethod, TopUp } from '../types';
import { api, errorText } from '../services/api';
import { Sheet } from './Sheet';
import { ErrorBox, money } from './ui';

export function WalletSheet({ onClose, onUpdated }: { onClose: () => void; onUpdated: () => void }) {
  const [methods, setMethods] = useState<ReceivingMethod[]>([]);
  const [amount, setAmount] = useState('50000');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<(TopUp & { receivingMethods?: ReceivingMethod[] }) | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<{ receivingMethods: ReceivingMethod[] }>('/topups/receiving-methods', undefined, false)
      .then((data) => { if (active) setMethods(data.receivingMethods.filter((item) => item.type === 'CARD_TRANSFER')); })
      .catch((err) => { if (active) setError(errorText(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (!request || request.status !== 'PENDING') return;
    let active = true;
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      api<TopUp>(`/topups/${request.id}`).then((next) => { if (active) { setRequest((previous) => ({ ...previous, ...next })); if (next.status === 'VERIFIED') onUpdated(); } }).catch(() => {});
    }, 7000);
    return () => { active = false; clearInterval(timer); clearInterval(clock); };
  }, [request?.id, request?.status, onUpdated]);
  async function reserve(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    const minor = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 2_000_000_000) return;
    lock.current = true; setBusy(true); setError('');
    try { setRequest(await api<TopUp & { receivingMethods: ReceivingMethod[] }>('/topups/reserve', { amountMinor: minor, type: 'CARD_TRANSFER' })); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); lock.current = false; }
  }
  async function confirm() {
    if (!request || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await api(`/topups/${request.id}/confirm-paid`, {}); setConfirmed(true); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); lock.current = false; }
  }
  const card = request?.receivingMethod || request?.receivingMethods?.[0];
  const remaining = request?.expiresAt ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - now) / 1000)) : 0;
  return <Sheet title="Balansni to'ldirish" onClose={onClose} busy={busy}>
    <div className="checkout-form">
      {error && <ErrorBox message={error} retry={() => setRevision((r) => r + 1)}/>}
      {request?.status === 'VERIFIED' ? <div className="checkout-result"><CheckCircle2 size={44}/><h3>Balans to'ldirildi</h3><p>{money(request.amountMinor)}</p><button className="button primary" onClick={onClose}>Tayyor</button></div> : request ? <>
        <span className="eyebrow">To'lov summasi</span><h3 className="amount-display">{money(request.amountMinor)}</h3>
        {card && <div className="bank-details"><CreditCard size={24}/><div><span>{card.bankName || 'Qabul qiluvchi karta'}</span><strong>{card.cardNumber}</strong><span>{card.cardHolderName}</span></div><button className="icon-button" aria-label="Karta raqamini nusxalash" title={copied ? 'Nusxalandi' : 'Nusxalash'} onClick={async () => { try { await navigator.clipboard.writeText(card.cardNumber); setCopied(true); } catch { setError('Karta raqamini belgilab nusxalang.'); } }}><Copy size={18}/></button></div>}
        <p className="notice">Aynan ko'rsatilgan summani o'tkazing. Balans to'lov tekshirilgandan keyin yangilanadi.</p>
        {request.expiresAt && <p className="muted">Qolgan vaqt: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>}
        {confirmed ? <div className="notice success"><CheckCircle2 size={20}/>To'lov tekshirilmoqda. Natija balansingizda ko'rinadi.</div> : <button className="button primary" disabled={busy || remaining === 0} onClick={confirm}>{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>}To'lovni amalga oshirdim</button>}
        {remaining === 0 && !confirmed && <p role="status">Muddat tugadi. To'lov qilgan bo'lsangiz, yordam xizmatiga buyurtma raqamini yuboring.</p>}
        <small className="muted">So'rov: {request.id}</small>
      </> : <form className="stack" onSubmit={reserve}>
        <label>Summa, so'm<input autoFocus type="number" min="1000" max="20000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required/></label>
        <div className="amount-options">{[25000, 50000, 100000, 200000].map((value) => <button className={`chip ${Number(amount) === value ? 'active' : ''}`} type="button" key={value} onClick={() => setAmount(String(value))}>{value.toLocaleString('uz-UZ')}</button>)}</div>
        {!loading && methods.length === 0 && !error && <p>To'ldirish usullari hozircha mavjud emas.</p>}
        <button className="button primary" type="submit" disabled={busy || loading || methods.length === 0}>{busy || loading ? <LoaderCircle className="spin" size={18}/> : <CreditCard size={18}/>}To'lov rekvizitlari</button>
      </form>}
    </div>
  </Sheet>;
}
