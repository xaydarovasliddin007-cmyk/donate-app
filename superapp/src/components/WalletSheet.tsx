import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Copy, CreditCard, Gamepad2, HelpCircle, Home, ImageUp, Landmark, LoaderCircle, Package, UserRound, WalletCards } from 'lucide-react';
import type { ReceivingMethod, TopUp, TopUpOption, Wallet } from '../types';
import { api, ApiError, errorText } from '../services/api';
import { Sheet } from './Sheet';
import { ErrorBox, money } from './ui';
import { tr, type Locale } from '../i18n';

export function WalletSheet({ wallet, onClose, onUpdated, onNavigate, locale }: { wallet: Wallet | null; onClose: () => void; onUpdated: () => void; onNavigate: (tab: 'shop' | 'games' | 'orders' | 'profile') => void; locale: Locale }) {
  const t = (text: string) => tr(locale, text);
  const [options, setOptions] = useState<TopUpOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<TopUpOption['id'] | null>(null);
  const [balance, setBalance] = useState<Wallet | null>(wallet);
  const [showGuide, setShowGuide] = useState(false);
  const [amount, setAmount] = useState('50000');
  const [amountConflict, setAmountConflict] = useState<{ requested: number; suggestions: number[] } | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<(TopUp & { receivingMethods?: ReceivingMethod[] }) | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const amountConflictRef = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<{ options: TopUpOption[] }>('/topups/options', undefined, false)
      .then((data) => { if (active) setOptions(data.options); })
      .catch((err) => { if (active) setError(errorText(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => { api<Wallet>('/wallet').then(setBalance).catch(() => {}); }, []);
  useEffect(() => {
    if (!amountConflict) return;
    const timer = window.setTimeout(() => amountConflictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    return () => clearTimeout(timer);
  }, [amountConflict]);
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
    lock.current = true; setBusy(true); setError(''); setAmountConflict(null);
    if (!selectedChannel) return;
    const type: ReceivingMethod['type'] = selectedChannel === 'BANKOMAT' ? 'PAYNET_TERMINAL' : 'CARD_TRANSFER';
    try { setRequest(await api<TopUp & { receivingMethods: ReceivingMethod[] }>('/topups/reserve', { amountMinor: minor, type, channel: selectedChannel })); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'TOPUP_AMOUNT_BUSY') {
        const details = err.details as { requestedAmountMinor?: number; suggestedAmountsMinor?: number[] } | undefined;
        setAmountConflict({
          requested: (details?.requestedAmountMinor || minor) / 100,
          suggestions: (details?.suggestedAmountsMinor || []).map((value) => value / 100),
        });
      } else setError(errorText(err));
    }
    finally { setBusy(false); lock.current = false; }
  }
  useEffect(() => () => { if (receiptPreview) URL.revokeObjectURL(receiptPreview); }, [receiptPreview]);
  function chooseReceipt(file: File | null) {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(''); setReceiptFile(null); setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Chek JPG, PNG yoki WEBP formatida va 5 MB dan kichik bo'lishi kerak.");
      return;
    }
    setReceiptFile(file); setReceiptPreview(URL.createObjectURL(file));
  }
  async function submitReceipt(event: FormEvent) {
    event.preventDefault(); if (!request || !receiptFile || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(receiptFile);
      });
      await api(`/topups/${request.id}/receipt`, { fileName: receiptFile.name, mimeType: receiptFile.type, dataBase64 });
      setConfirmed(true);
    }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); lock.current = false; }
  }
  const requestMethods = request?.receivingMethod ? [request.receivingMethod] : request?.receivingMethods || [];
  const remaining = request?.expiresAt ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - now) / 1000)) : 0;
  const methodInfo: Record<TopUpOption['id'], { description: string; icon?: typeof CreditCard; asset?: string }> = {
    HUMO: { description: "Avtomatik tasdiqlanadi", asset: "payment/humo.png" },
    UZCARD: { description: "Avtomatik tasdiqlanadi", asset: "payment/uzcard.png" },
    BANKOMAT: { description: "Screenshot orqali tasdiqlanadi", icon: Landmark },
  };
  return <Sheet title={t("Balansni to'ldirish")} onClose={onClose} busy={busy} className="wallet-sheet">
    <div className="checkout-form">
      <section className="wallet-balance-card"><span>{locale === 'ru' ? 'БАЛАНС' : 'BALANS'}</span><strong>{balance ? money(balance.balanceMinor, balance.currency, locale) : '...'}</strong><WalletCards size={38}/></section>
      {error && <ErrorBox message={error} retry={() => setRevision((r) => r + 1)} locale={locale}/>}
      {request?.status === 'VERIFIED' ? <div className="checkout-result"><CheckCircle2 size={44}/><h3>{t("Balans to'ldirildi")}</h3><p>{money(request.amountMinor, 'UZS', locale)}</p><button className="button primary" onClick={onClose}>{t('Tayyor')}</button></div> : request ? <>
        <div className="topup-total"><span className="eyebrow">{t("TO'LOV SUMMASI")}</span><h3 className="amount-display">{money(request.amountMinor, 'UZS', locale)}</h3></div>
        {request.type === 'QR_CODE' ? <div className="qr-methods">{requestMethods.map((method) => method.qrPayload && <div className="qr-method" key={method.id}><GeneratedQr payload={method.qrPayload}/><strong>{method.cardHolderName}</strong><span>{method.bankName || 'QR orqali to‘lov'}</span></div>)}</div> : <div className="bank-methods">{requestMethods.map((method) => <div className="bank-details" key={method.id}>{request.channel === 'BANKOMAT' ? <Landmark size={25}/> : <img className="bank-card-logo" src={request.channel === 'UZCARD' ? 'payment/uzcard.png' : 'payment/humo.png'} alt={request.channel === 'UZCARD' ? 'UZCARD' : 'HUMO'}/>}<div><span>{method.bankName || (request.type === 'PAYNET_TERMINAL' ? 'Bankomat uchun karta' : 'Qabul qiluvchi karta')}</span><strong>{method.cardNumber}</strong><span>{method.cardHolderName}</span></div>{method.cardNumber && <button className="icon-button" aria-label="Karta raqamini nusxalash" title={copied ? 'Nusxalandi' : 'Nusxalash'} onClick={async () => { try { await navigator.clipboard.writeText(method.cardNumber!); setCopied(true); } catch { setError('Karta raqamini belgilab nusxalang.'); } }}><Copy size={18}/></button>}</div>)}</div>}
        <p className="notice">{request.type === 'PAYNET_TERMINAL' ? (locale === 'ru' ? 'Переведите точную сумму через банкомат и загрузите фото чека.' : "Bankomatda aynan ko'rsatilgan summani o'tkazing va chekni rasmga olib yuklang.") : (locale === 'ru' ? 'Переведите точную сумму. Баланс обновится автоматически после уведомления банка.' : "Aynan ko'rsatilgan summani o'tkazing. Bank xabari kelishi bilan balans avtomatik yangilanadi.")}</p>
        {request.expiresAt && <p className="muted">{t('Qolgan vaqt:')} {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>}
        {request.type === 'PAYNET_TERMINAL' ? confirmed ? <div className="notice success"><CheckCircle2 size={20}/>{t('Chek adminga yuborildi. Tasdiqlangach balans yangilanadi.')}</div> : <form className="stack compact" onSubmit={submitReceipt}><label className="receipt-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseReceipt(event.target.files?.[0] || null)}/>{receiptPreview ? <img src={receiptPreview} alt={t('Yuklangan chek')}/> : <span><ImageUp size={28}/><strong>{t('Chek screenshotini yuklang')}</strong><small>{t('JPG, PNG yoki WEBP · 5 MB gacha')}</small></span>}</label><button className="button primary" disabled={busy || remaining === 0 || !receiptFile}>{busy ? <LoaderCircle className="spin" size={18}/> : <ImageUp size={18}/>} {t('Chekni yuborish')}</button></form> : <div className="notice success"><LoaderCircle className="spin" size={20}/><div><strong>{t('Avtomatik tekshirilmoqda')}</strong><br/><span>{t("Ilovani yopmang. To'lov aniqlanganda balans o'zi yangilanadi.")}</span></div></div>}
        {remaining === 0 && !confirmed && <p role="status">{t("Muddat tugadi. To'lov qilgan bo'lsangiz, yordam xizmatiga buyurtma raqamini yuboring.")}</p>}
        <small className="muted">{t("So'rov:")} {request.id}</small>
      </> : !selectedChannel ? <section className="topup-step"><div><span className="eyebrow accent-text">{t('1-QADAM')}</span><h3>{t("To'lov usulini tanlang")}</h3></div>{loading ? <div className="skeleton list-skeleton"/> : options.length ? <div className="payment-method-list">{options.map((option) => { const info = methodInfo[option.id]; const Icon = info.icon; return <button key={option.id} disabled={!option.available} onClick={() => setSelectedChannel(option.id)}><span>{info.asset ? <img src={info.asset} alt=""/> : Icon ? <Icon size={26}/> : null}</span><div><strong>{option.label}</strong><small>{option.available ? t(info.description) : t('Hozircha sozlanmagan')}</small></div><ChevronRight className="method-check" size={19}/></button>; })}</div> : !error && <p>{t("To'lov usullari hozircha mavjud emas.")}</p>}<div className="topup-minimum"><span>{t("Minimal summa: 1 000 so'm")}</span><button onClick={() => setShowGuide((value) => !value)}>{t('Qanday ishlaydi?')} <ChevronRight size={15}/></button></div><button className="topup-guide-link" onClick={() => setShowGuide((value) => !value)}><span><HelpCircle size={22}/></span><div><strong>{t("Balansni qanday to'ldirish mumkin?")}</strong><small>{t("Bosqichma-bosqich qo'llanma")}</small></div><ChevronRight size={18}/></button>{showGuide && <ol className="topup-guide"><li>{t('HUMO va UZCARD mavjud HUMO kartalari orqali avtomatik tekshiriladi.')}</li><li>{t('Bankomat chekini screenshot qilib yuklang.')}</li><li>{t('Screenshot Telegram orqali adminga boradi.')}</li></ol>}</section> : <form className="stack" onSubmit={reserve}>
        <button className="topup-back" type="button" onClick={() => setSelectedChannel(null)}><ArrowLeft size={17}/> {t("To'lov usullari")}</button>
        <div><span className="eyebrow accent-text">{t('2-QADAM')}</span><h3>{t('Summani kiriting')}</h3></div>
        {selectedChannel && <div className="selected-payment-method">{(() => { const option = options.find((item) => item.id === selectedChannel); if (!option) return null; const info = methodInfo[option.id]; const InfoIcon = info.icon; return <>{info.asset ? <img src={info.asset} alt=""/> : InfoIcon ? <InfoIcon size={21}/> : null}<span>{option.label}</span><CheckCircle2 size={18}/></>; })()}</div>}
        <label>{t("Summa, so'm")}<input autoFocus type="number" min="1000" max="20000000" step="1" value={amount} onChange={(event) => { setAmount(event.target.value); setAmountConflict(null); }} required/></label>
        <div className="amount-options">{[25000, 50000, 100000, 200000].map((value) => <button className={`chip ${Number(amount) === value ? 'active' : ''}`} type="button" key={value} onClick={() => { setAmount(String(value)); setAmountConflict(null); }}>{value.toLocaleString(locale === 'ru' ? 'ru-RU' : 'uz-UZ')}</button>)}</div>
        {amountConflict && <div className="amount-conflict" ref={amountConflictRef} role="alert"><AlertCircle size={22}/><div><strong>{amountConflict.requested.toLocaleString(locale === 'ru' ? 'ru-RU' : 'uz-UZ')} {locale === 'ru' ? 'сум временно занята' : "so'm hozircha band"}</strong><p>{t("Iltimos, bo'sh summalardan birini tanlab qayta urinib ko'ring.")}</p>{amountConflict.suggestions.length > 0 && <div>{amountConflict.suggestions.map((value) => <button type="button" key={value} onClick={() => { setAmount(String(value)); setAmountConflict(null); }}>{value.toLocaleString(locale === 'ru' ? 'ru-RU' : 'uz-UZ')} {locale === 'ru' ? 'сум' : "so'm"}</button>)}</div>}</div></div>}
        <button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <CreditCard size={18}/>} {t("To'lov rekvizitlari")}</button>
      </form>}
    </div>
    <nav className="bottom-nav wallet-bottom-nav" aria-label="Balans sahifasi bo'limlari">
      <button onClick={() => onNavigate('shop')}><span><Home size={21}/></span>{t('Asosiy')}</button>
      <button onClick={() => onNavigate('games')}><span><Gamepad2 size={21}/></span>{t("O'yinlar")}</button>
      <button className="nav-wallet active" aria-current="page"><span><WalletCards size={22}/></span>{t('Balans')}</button>
      <button onClick={() => onNavigate('orders')}><span><Package size={21}/></span>{t('Buyurtmalar')}</button>
      <button onClick={() => onNavigate('profile')}><span><UserRound size={21}/></span>{t('Profil')}</button>
    </nav>
  </Sheet>;
}

function GeneratedQr({ payload }: { payload: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let active = true; QRCode.toDataURL(payload, { width: 260, margin: 1, errorCorrectionLevel: 'M' }).then((value) => { if (active) setSrc(value); }).catch(() => {}); return () => { active = false; }; }, [payload]);
  return src ? <img className="payment-qr" src={src} alt="To'lov QR kodi"/> : <div className="payment-qr skeleton"/>;
}
