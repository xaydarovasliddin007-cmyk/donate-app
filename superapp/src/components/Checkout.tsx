import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import type { CheckoutInput, Game, GameServer, Order, Product, Wallet } from '../types';
import { api, errorText } from '../services/api';
import { haptic } from '../services/telegram';
import { Sheet } from './Sheet';
import { ErrorBox, GameImage, money } from './ui';

export function Checkout({ game, onClose, onUpdated, wallet, authenticated }: {
  game: Game; onClose: () => void; onUpdated: () => void; wallet: Wallet | null; authenticated: boolean;
}) {
  const [servers, setServers] = useState<GameServer[]>([]);
  const [server, setServer] = useState('');
  const [serversReady, setServersReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [playerId, setPlayerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [step, setStep] = useState<'product' | 'review' | 'done'>('product');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);
  const attempt = useRef<{ signature: string; key: string }>();
  const locked = useRef(false);
  const needsZone = game.slug === 'mobile-legends';
  const usesTag = ['clash-of-clans', 'clash-royale', 'brawl-stars'].includes(game.slug);
  const usesName = ['roblox', 'telegram-premium', 'steam-wallet'].includes(game.slug);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setServersReady(false);
    api<{ servers: GameServer[] }>(`/games/${game.id}/servers`, undefined, false)
      .then((data) => { if (active) { setServers(data.servers); setServer(data.servers[0]?.code || ''); setServersReady(true); } })
      .catch((err) => { if (active) { setError(errorText(err)); setLoading(false); } });
    return () => { active = false; };
  }, [game.id, revision]);
  useEffect(() => {
    if (!serversReady) return;
    let active = true;
    setLoading(true); setProduct(null); setError('');
    api<{ products: Product[] }>(`/games/${game.id}/products${server ? `?serverId=${encodeURIComponent(server)}` : ''}`, undefined, authenticated)
      .then((data) => { if (active) setProducts(data.products); })
      .catch((err) => { if (active) setError(errorText(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [game.id, server, serversReady, authenticated]);

  function review(event: FormEvent) {
    event.preventDefault();
    if (!product || !playerId.trim() || (needsZone && !zoneId.trim())) return;
    setError(''); setStep('review'); haptic();
  }
  async function pay() {
    if (locked.current || !product) return;
    locked.current = true; setBusy(true); setError('');
    const details = { gameId: game.id, productId: product.id, playerId: playerId.trim(), serverId: server || undefined, zoneId: needsZone ? zoneId.trim() : undefined };
    const signature = JSON.stringify(details);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    const input: CheckoutInput = { ...details, idempotencyKey: attempt.current.key };
    try {
      const order = await api<Order>('/orders', input);
      await api('/payments/wallet', { orderId: order.id, idempotencyKey: `wallet:${order.id}` });
      setResult(await api<Order>(`/orders/${order.id}`));
      setStep('done'); onUpdated();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); locked.current = false; }
  }
  const price = product ? money(product.amountMinor, product.currency) : '';
  return <Sheet title={game.name} onClose={onClose} busy={busy}>
    {step === 'done' ? <div className="checkout-result">
      <CheckCircle2 size={48}/><h3>{result?.status === 'COMPLETED' ? 'Xarid bajarildi' : 'Buyurtma qabul qilindi'}</h3>
      <p>#{result?.orderNumber}</p><p>Holatini Buyurtmalar bo'limida kuzatishingiz mumkin.</p>
      <button className="button primary" onClick={onClose}>Tayyor <Check size={18}/></button>
    </div> : <>
      <div className="checkout-game"><GameImage game={game}/><div><span className="eyebrow">{game.category}</span><h3>{game.name}</h3><span className="muted">UZDONATE balans orqali to'lov</span></div></div>
      {!game.isPurchasable ? <div className="empty-state"><h3>Tez kunda</h3><p>Bu o'yin uchun paketlar hali mavjud emas.</p></div> : step === 'product' ? <form onSubmit={review} className="checkout-form">
        {servers.length > 0 && <label>Hudud<select value={server} onChange={(event) => setServer(event.target.value)}>{servers.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></label>}
        <div className="section-heading"><h3>Paketni tanlang</h3><span className="muted">{products.length} ta paket</span></div>
        {error && <ErrorBox message={error} retry={() => setRevision((r) => r + 1)}/>}
        {loading ? <div className="product-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton product-skeleton"/>)}</div> : <div className="product-grid" role="radiogroup" aria-label="Paketlar">
          {products.map((item) => <button key={item.id} type="button" role="radio" aria-checked={product?.id === item.id}
            className={`product-option ${product?.id === item.id ? 'selected' : ''}`}
            onClick={() => { setProduct(item); haptic(); }}>
            <span className="product-icon"><img src="assets-store/diamond.png" alt=""/>{product?.id === item.id && <Check size={15}/>}</span>
            <strong>{item.name}</strong><span>{money(item.amountMinor, item.currency)}</span>
          </button>)}
        </div>}
        {!loading && !error && products.length === 0 && <div className="empty-state"><p>Bu hudud uchun paketlar hozircha yo'q.</p></div>}
        <div className="section-heading"><h3>O'yindagi hisob</h3></div>
        <div className="field-grid"><label>{usesName ? 'Foydalanuvchi nomi' : usesTag ? 'O\'yinchi tegi' : 'Player ID'}
          <input autoComplete="off" value={playerId} onChange={(event) => setPlayerId(event.target.value)} required maxLength={64}
            inputMode={usesTag || usesName ? 'text' : 'numeric'} pattern={usesTag || usesName ? undefined : '[0-9]+'}
            placeholder={usesName ? 'Username' : usesTag ? '#ABC123' : '123456789'}/></label>
          {needsZone && <label>Zone ID<input value={zoneId} onChange={(event) => setZoneId(event.target.value)} required maxLength={32} inputMode="numeric" pattern="[0-9]+" placeholder="1234"/></label>}
        </div>
        {!authenticated && <p className="muted">Xarid uchun hisobga kirish kerak. Ilovani qayta oching.</p>}
        <footer className="checkout-footer"><div><span className="muted">Jami</span><strong>{price || 'Paket tanlanmagan'}</strong></div>
          <button className="button primary" type="submit" disabled={!product || loading || !authenticated}>Davom etish <ArrowRight size={18}/></button></footer>
      </form> : <div className="checkout-form">
        <h3>Buyurtmani tasdiqlang</h3><dl className="receipt"><div><dt>Paket</dt><dd>{product?.name}</dd></div><div><dt>Player ID</dt><dd>{playerId}</dd></div>{needsZone && <div><dt>Zone ID</dt><dd>{zoneId}</dd></div>}{server && <div><dt>Hudud</dt><dd>{servers.find((s) => s.code === server)?.name}</dd></div>}<div className="receipt-total"><dt>Jami</dt><dd>{price}</dd></div></dl>
        <p className="notice"><ShieldCheck size={19}/>O'yin ID va hududni tekshiring. Paket shu hisobga yuboriladi.</p>
        {wallet && wallet.balanceMinor < (product?.amountMinor ?? 0) && <ErrorBox message="Balans yetarli emas. Profil bo'limida hisobingizni to'ldiring."/>}
        {error && <ErrorBox message={error}/>}
        <button className="button primary full-width" disabled={busy || !wallet || wallet.balanceMinor < (product?.amountMinor ?? 0)} onClick={pay}>
          {busy ? <LoaderCircle className="spin" size={18}/> : <ShieldCheck size={18}/>}{busy ? 'Kutilmoqda...' : `${price} to'lash`}
        </button><button className="button subtle full-width" disabled={busy} onClick={() => setStep('product')}>Ma'lumotlarni o'zgartirish</button>
      </div>}
    </>}
  </Sheet>;
}
