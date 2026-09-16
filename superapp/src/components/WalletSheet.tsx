import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, Banknote, CheckCircle2, ChevronRight, Copy, CreditCard, Gamepad2, HelpCircle, Home, LoaderCircle, Package, QrCode, UserRound, WalletCards } from 'lucide-react';
import type { ReceivingMethod, TopUp, Wallet } from '../types';
import { api, errorText } from '../services/api';
import { Sheet } from './Sheet';
import { ErrorBox, money } from './ui';

export function WalletSheet({ wallet, onClose, onUpdated, onNavigate }: { wallet: Wallet | null; onClose: () => void; onUpdated: () => void; onNavigate: (tab: 'shop' | 'games' | 'orders' | 'profile') => void }) {
  const [methods, setMethods] = useState<ReceivingMethod[]>([]);
  const [selectedType, setSelectedType] = useState<ReceivingMethod['type'] | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [balance, setBalance] = useState<Wallet | null>(wallet);
  const [showGuide, setShowGuide] = useState(false);
  const [amount, setAmount] = useState('50000');
  const [reference, setReference] = useState('');
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
      .then((data) => { if (active) setMethods(data.receivingMethods); })
      .catch((err) => { if (active) setError(errorText(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => { api<Wallet>('/wallet').then(setBalance).catch(() => {}); }, []);
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
    if (!selectedType) return;
    try { setRequest(await api<TopUp & { receivingMethods: ReceivingMethod[] }>('/topups/reserve', { amountMinor: minor, type: selectedType })); }
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
  async function submitReference(event: FormEvent) {
    event.preventDefault(); if (!request || !reference.trim() || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await api(`/topups/${request.id}/reference`, { userReference: reference.trim() }); setConfirmed(true); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); lock.current = false; }
  }
  const requestMethods = request?.receivingMethod ? [request.receivingMethod] : request?.receivingMethods || [];
  const remaining = request?.expiresAt ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - now) / 1000)) : 0;
  const methodInfo: Record<ReceivingMethod['type'], { label: string; description: string; icon: typeof CreditCard }> = {
    CARD_TRANSFER: { label: "Bank kartasi", description: "Uzcard yoki Humo orqali o'tkazma", icon: CreditCard },
    QR_CODE: { label: "QR orqali", description: "Bank ilovasida QR kodni skanerlang", icon: QrCode },
    PAYNET_TERMINAL: { label: "Paynet terminal", description: "Terminalda naqd pul bilan", icon: Banknote },
  };
  return <Sheet title="Balansni to'ldirish" onClose={onClose} busy={busy} className="wallet-sheet">
    <div className="checkout-form">
      <section className="wallet-balance-card"><span>BALANS</span><strong>{balance ? money(balance.balanceMinor, balance.currency) : '...'}</strong><WalletCards size={38}/></section>
      {error && <ErrorBox message={error} retry={() => setRevision((r) => r + 1)}/>}
      {request?.status === 'VERIFIED' ? <div className="checkout-result"><CheckCircle2 size={44}/><h3>Balans to'ldirildi</h3><p>{money(request.amountMinor)}</p><button className="button primary" onClick={onClose}>Tayyor</button></div> : request ? <>
        <div className="topup-total"><span className="eyebrow">TO'LOV SUMMASI</span><h3 className="amount-display">{money(request.amountMinor)}</h3></div>
        {request.type === 'QR_CODE' ? <div className="qr-methods">{requestMethods.map((method) => method.qrPayload && <div className="qr-method" key={method.id}><GeneratedQr payload={method.qrPayload}/><strong>{method.cardHolderName}</strong><span>{method.bankName || 'QR orqali to‘lov'}</span></div>)}</div> : <div className="bank-methods">{requestMethods.map((method) => <div className="bank-details" key={method.id}><CreditCard size={24}/><div><span>{method.bankName || (request.type === 'PAYNET_TERMINAL' ? 'Paynet uchun karta' : 'Qabul qiluvchi karta')}</span><strong>{method.cardNumber}</strong><span>{method.cardHolderName}</span></div>{method.cardNumber && <button className="icon-button" aria-label="Karta raqamini nusxalash" title={copied ? 'Nusxalandi' : 'Nusxalash'} onClick={async () => { try { await navigator.clipboard.writeText(method.cardNumber!); setCopied(true); } catch { setError('Karta raqamini belgilab nusxalang.'); } }}><Copy size={18}/></button>}</div>)}</div>}
        <p className="notice">{request.type === 'PAYNET_TERMINAL' ? "Terminalda aynan ko'rsatilgan summani o'tkazing va chek raqamini kiriting." : "Aynan ko'rsatilgan summani o'tkazing. Balans to'lov tekshirilgandan keyin yangilanadi."}</p>
        {request.expiresAt && <p className="muted">Qolgan vaqt: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>}
        {confirmed ? <div className="notice success"><CheckCircle2 size={20}/>To'lov tekshirilmoqda. Natija balansingizda ko'rinadi.</div> : request.type === 'PAYNET_TERMINAL' ? <form className="stack compact" onSubmit={submitReference}><label>Chek raqami<input value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={200} placeholder="Masalan: 12345678"/></label><button className="button primary" disabled={busy || remaining === 0 || !reference.trim()}>{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>}Chekni yuborish</button></form> : <button className="button primary" disabled={busy || remaining === 0} onClick={confirm}>{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>}To'lovni amalga oshirdim</button>}
        {remaining === 0 && !confirmed && <p role="status">Muddat tugadi. To'lov qilgan bo'lsangiz, yordam xizmatiga buyurtma raqamini yuboring.</p>}
        <small className="muted">So'rov: {request.id}</small>
      </> : !selectedType ? <section className="topup-step"><div><span className="eyebrow accent-text">1-QADAM</span><h3>To'lov usulini tanlang</h3></div>{loading ? <div className="skeleton list-skeleton"/> : methods.length ? <div className="payment-method-list">{methods.map((method) => { const info = methodInfo[method.type]; const Icon = info.icon; const title = method.type === 'CARD_TRANSFER' ? method.bankName || info.label : method.cardHolderName || info.label; return <button key={method.id} onClick={() => { setSelectedMethodId(method.id); setSelectedType(method.type); }}><span><Icon size={26}/></span><div><strong>{title}</strong><small>{info.description}</small></div><ChevronRight className="method-check" size={19}/></button>; })}</div> : !error && <p>To'ldirish usullari hozircha mavjud emas.</p>}<div className="topup-minimum"><span>Minimal summa: 1 000 so'm</span><button onClick={() => setShowGuide((value) => !value)}>Qanday ishlaydi? <ChevronRight size={15}/></button></div><button className="topup-guide-link" onClick={() => setShowGuide((value) => !value)}><span><HelpCircle size={22}/></span><div><strong>Balansni qanday to'ldirish mumkin?</strong><small>Bosqichma-bosqich qo'llanma</small></div><ChevronRight size={18}/></button>{showGuide && <ol className="topup-guide"><li>To'lov usulini tanlang.</li><li>Kerakli summani kiriting.</li><li>Berilgan rekvizitga aynan shu summani o'tkazing.</li></ol>}</section> : <form className="stack" onSubmit={reserve}>
        <button className="topup-back" type="button" onClick={() => { setSelectedType(null); setSelectedMethodId(null); }}><ArrowLeft size={17}/> To'lov usullari</button>
        <div><span className="eyebrow accent-text">2-QADAM</span><h3>Summani kiriting</h3></div>
        {selectedMethodId && <div className="selected-payment-method">{(() => { const method = methods.find((item) => item.id === selectedMethodId); if (!method) return null; const InfoIcon = methodInfo[method.type].icon; return <><InfoIcon size={21}/><span>{method.type === 'CARD_TRANSFER' ? method.bankName || methodInfo[method.type].label : method.cardHolderName}</span><CheckCircle2 size={18}/></>; })()}</div>}
        <label>Summa, so'm<input autoFocus type="number" min="1000" max="20000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required/></label>
        <div className="amount-options">{[25000, 50000, 100000, 200000].map((value) => <button className={`chip ${Number(amount) === value ? 'active' : ''}`} type="button" key={value} onClick={() => setAmount(String(value))}>{value.toLocaleString('uz-UZ')}</button>)}</div>
        <button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <CreditCard size={18}/>}To'lov rekvizitlari</button>
      </form>}
    </div>
    <nav className="bottom-nav wallet-bottom-nav" aria-label="Balans sahifasi bo'limlari">
      <button onClick={() => onNavigate('shop')}><span><Home size={21}/></span>Asosiy</button>
      <button onClick={() => onNavigate('games')}><span><Gamepad2 size={21}/></span>O'yinlar</button>
      <button className="nav-wallet active" aria-current="page"><span><WalletCards size={22}/></span>Balans</button>
      <button onClick={() => onNavigate('orders')}><span><Package size={21}/></span>Buyurtmalar</button>
      <button onClick={() => onNavigate('profile')}><span><UserRound size={21}/></span>Profil</button>
    </nav>
  </Sheet>;
}

function GeneratedQr({ payload }: { payload: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let active = true; QRCode.toDataURL(payload, { width: 260, margin: 1, errorCorrectionLevel: 'M' }).then((value) => { if (active) setSrc(value); }).catch(() => {}); return () => { active = false; }; }, [payload]);
  return src ? <img className="payment-qr" src={src} alt="To'lov QR kodi"/> : <div className="payment-qr skeleton"/>;
}
