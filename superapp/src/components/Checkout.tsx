import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleUserRound, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { CheckoutInput, Game, GameServer, Order, Product, Wallet } from '../types';
import { api, errorText } from '../services/api';
import { haptic } from '../services/telegram';
import { Sheet } from './Sheet';
import { ErrorBox, GameImage, money } from './ui';
import { tr, type Locale } from '../i18n';

type ProductVisual = { icon: string; badge?: string; tone: string };

function productVisual(name: string, amountMinor: number): ProductVisual {
  const lower = name.toLowerCase();
  const words = name
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  if (lower.includes('x2')) return { icon: 'diamondpile.png', badge: 'x2', tone: 'bonus' };
  if (lower.includes('twilight')) return { icon: 'twilight-pass.png', badge: 'PASS', tone: 'pass' };
  if (lower.includes('elite')) return { icon: 'moneybag.png', badge: 'VIP', tone: 'elite' };
  if (lower.includes('weekly') || lower.includes('monthly') || lower.includes('membership') || lower.includes('pass')) {
    return {
      icon: 'pass.png',
      badge: lower.includes('monthly') ? '30D' : '7D',
      tone: 'pass',
    };
  }
  if (words.includes('UC'))
    return {
      icon: amountMinor >= 15_000_000 ? 'uc_stack.png' : 'uc_coin.png',
      tone: 'gold',
    };
  if (words.includes('ROBUX')) return { icon: 'gem_silver.png', tone: 'silver' };
  if (words.includes('GEMS')) return { icon: 'gem_purple.png', tone: 'purple' };
  if (words.includes('CP')) return { icon: 'gem_green.png', tone: 'green' };
  if (words.includes('CASH')) return { icon: 'coin_cash.png', tone: 'green' };
  if (words.includes('FC')) return { icon: 'coin_fc.png', tone: 'blue' };
  if (words.includes('TOKENS')) return { icon: 'coin_token.png', tone: 'warm' };
  if (lower.includes('genesis crystal')) return { icon: 'crystal_cyan.png', tone: 'cyan' };
  if (lower.includes('diamond')) {
    if (amountMinor >= 80_000_000) return { icon: 'truck.png', tone: 'cyan' };
    if (amountMinor >= 15_000_000) return { icon: 'safe.png', tone: 'cyan' };
    if (amountMinor >= 3_000_000) return { icon: 'diamondpile.png', tone: 'cyan' };
    return { icon: 'diamond.png', tone: 'cyan' };
  }
  return { icon: 'coin.png', tone: 'gold' };
}

function ProductIcon({ item, selected }: { item: Product; selected: boolean }) {
  const visual = productVisual(item.name, item.amountMinor);
  return (
    <span className={`product-icon tone-${visual.tone}`}>
      <img src={`assets-store/${visual.icon}`} alt="" />
      {visual.badge && <i className="product-badge">{visual.badge}</i>}
      {selected && <Check className="product-check" size={15} />}
    </span>
  );
}

export function Checkout({ game, onClose, onUpdated, wallet, authenticated, locale }: { game: Game; onClose: () => void; onUpdated: () => void; wallet: Wallet | null; authenticated: boolean; locale: Locale }) {
  const t = (text: string) => tr(locale, text);
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
  const [step, setStep] = useState<'product' | 'details' | 'review' | 'done'>('product');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);
  const attempt = useRef<{ signature: string; key: string }>();
  const locked = useRef(false);
  const needsZone = game.slug === 'mobile-legends';
  const usesTag = ['clash-of-clans', 'clash-royale', 'brawl-stars'].includes(game.slug);
  const usesName = ['roblox', 'telegram-premium', 'steam-wallet'].includes(game.slug);
  const accountLabel = usesName ? t('Foydalanuvchi nomi') : usesTag ? t("O'yinchi tegi") : 'Player ID';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setServersReady(false);
    api<{ servers: GameServer[] }>(`/games/${game.id}/servers`, undefined, false)
      .then((data) => {
        if (active) {
          setServers(data.servers);
          setServer(data.servers[0]?.code || '');
          setServersReady(true);
        }
      })
      .catch((err) => {
        if (active) {
          setError(errorText(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [game.id, revision]);
  useEffect(() => {
    if (!serversReady) return;
    let active = true;
    setLoading(true);
    setProduct(null);
    setError('');
    api<{ products: Product[] }>(`/games/${game.id}/products${server ? `?serverId=${encodeURIComponent(server)}` : ''}`, undefined, authenticated)
      .then((data) => {
        if (active) setProducts(data.products);
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [game.id, server, serversReady, authenticated]);

  function selectProduct(item: Product) {
    setProduct(item);
    setError('');
    setStep('details');
    haptic();
  }
  function review(event: FormEvent) {
    event.preventDefault();
    if (!product || !playerId.trim() || (needsZone && !zoneId.trim())) return;
    setError('');
    setStep('review');
    haptic();
  }
  function goBack() {
    if (busy) return;
    if (step === 'done') return onClose();
    if (step === 'review') return setStep('details');
    if (step === 'details') return setStep('product');
    onClose();
  }
  async function pay() {
    if (locked.current || !product) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const details = {
      gameId: game.id,
      productId: product.id,
      playerId: playerId.trim(),
      serverId: server || undefined,
      zoneId: needsZone ? zoneId.trim() : undefined,
    };
    const signature = JSON.stringify(details);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    const input: CheckoutInput = {
      ...details,
      idempotencyKey: attempt.current.key,
    };
    try {
      const order = await api<Order>('/orders', input);
      await api('/payments/wallet', {
        orderId: order.id,
        idempotencyKey: `wallet:${order.id}`,
      });
      setResult(await api<Order>(`/orders/${order.id}`));
      setStep('done');
      onUpdated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  const price = product ? money(product.amountMinor, product.currency, locale) : '';
  const currentStep = step === 'product' ? 1 : step === 'details' ? 2 : 3;
  return (
    <Sheet title={game.name} onClose={onClose} onBack={goBack} busy={busy} className="checkout-sheet">
      {step === 'done' ? (
        <div className="checkout-result">
          <span className="result-mark">
            <CheckCircle2 size={48} />
          </span>
          <span className="eyebrow accent-text">{t('MUVAFFAQIYATLI')}</span>
          <h3>{t(result?.status === 'COMPLETED' ? 'Xarid bajarildi' : 'Buyurtma qabul qilindi')}</h3>
          <p>#{result?.orderNumber}</p>
          <p>{t("Holatini Buyurtmalar bo'limida kuzatishingiz mumkin.")}</p>
          <button className="button primary" onClick={onClose}>
            {t('Tayyor')} <Check size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="checkout-game">
            <GameImage game={game} />
            <div>
              <span className="eyebrow">{game.category}</span>
              <h3>{game.name}</h3>
              <span className="muted">{t("UZDONATE balans orqali to'lov")}</span>
            </div>
          </div>
          {game.isPurchasable && (
            <div className="checkout-progress" aria-label={`Buyurtma bosqichi: ${currentStep}/3`}>
              {[
                ['1', 'Paket'],
                ['2', 'Hisob'],
                ['3', 'Tasdiq'],
              ].map(([number, label], index) => (
                <div key={number} className={currentStep >= index + 1 ? 'active' : ''}>
                  <span>{currentStep > index + 1 ? <Check size={13} /> : number}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          )}
          {!game.isPurchasable ? (
            <div className="empty-state">
              <h3>Tez kunda</h3>
              <p>Bu o'yin uchun paketlar hali mavjud emas.</p>
            </div>
          ) : step === 'product' ? (
            <div className="checkout-form checkout-view view-forward">
              {servers.length > 0 && (
                <label>
                  Hudud
                  <select value={server} onChange={(event) => setServer(event.target.value)}>
                    {servers.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="checkout-intro">
                <span>
                  <Sparkles size={20} />
                </span>
                <div>
                  <h3>{t('Paketni tanlang')}</h3>
                  <p>{t("Kerakli paket ustiga bosing. Keyingi qadamda o'yin hisobingizni kiritasiz.")}</p>
                </div>
              </div>
              <div className="section-heading">
                <span className="muted">{t('Mavjud paketlar')}</span>
                <span className="muted">{products.length} {t('ta')}</span>
              </div>
              {error && <ErrorBox message={error} retry={() => setRevision((r) => r + 1)} locale={locale} />}
              {loading ? (
                <div className="product-grid">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton product-skeleton" />
                  ))}
                </div>
              ) : (
                <div className="product-grid" role="radiogroup" aria-label="Paketlar">
                  {products.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={product?.id === item.id} className={`product-option ${product?.id === item.id ? 'selected' : ''}`} onClick={() => selectProduct(item)}>
                      <ProductIcon item={item} selected={product?.id === item.id} />
                      <strong>{item.name}</strong>
                      <span>{money(item.amountMinor, item.currency, locale)}</span>
                      <i className="product-next">
                        <ArrowRight size={13} />
                      </i>
                    </button>
                  ))}
                </div>
              )}
              {!loading && !error && products.length === 0 && (
                <div className="empty-state">
                  <p>Bu hudud uchun paketlar hozircha yo'q.</p>
                </div>
              )}
              {!authenticated && <p className="muted">Xarid uchun hisobga kirish kerak. Ilovani qayta oching.</p>}
            </div>
          ) : step === 'details' ? (
            <form onSubmit={review} className="checkout-form checkout-view view-forward account-step">
              <button type="button" className="checkout-back" onClick={() => setStep('product')}>
                <ArrowLeft size={17} />
                {t('Paketlarga qaytish')}
              </button>
              {product && (
                <div className="selected-product">
                  <ProductIcon item={product} selected={false} />
                  <div>
                    <span className="eyebrow">{t('TANLANGAN PAKET')}</span>
                    <strong>{product.name}</strong>
                    <small>{price}</small>
                  </div>
                  <button type="button" onClick={() => setStep('product')}>
                  {t('Almashtirish')}
                  </button>
                </div>
              )}
              <div className="account-heading">
                <span>
                  <CircleUserRound size={27} />
                </span>
                <div>
                  <span className="eyebrow accent-text">2-QADAM</span>
                  <h3>{t("O'yin hisobingizni kiriting")}</h3>
                  <p>{t('Diamonds yoki valyuta aynan shu hisobga yuboriladi.')}</p>
                </div>
              </div>
              <div className="field-grid account-fields">
                <label>
                  {accountLabel}
                  <input autoFocus autoComplete="off" value={playerId} onChange={(event) => setPlayerId(event.target.value)} required maxLength={64} inputMode={usesTag || usesName ? 'text' : 'numeric'} pattern={usesTag || usesName ? undefined : '[0-9]+'} placeholder={usesName ? 'Username' : usesTag ? '#ABC123' : '123456789'} />
                </label>
                {needsZone && (
                  <label>
                    Zone ID
                    <input value={zoneId} onChange={(event) => setZoneId(event.target.value)} required maxLength={32} inputMode="numeric" pattern="[0-9]+" placeholder="1234" />
                  </label>
                )}
              </div>
              <p className="account-hint">
                <ShieldCheck size={17} />
                {t("ID ma'lumotlari faqat buyurtmani o'yin hisobiga yetkazish uchun ishlatiladi.")}
              </p>
              {!authenticated && <p className="muted">Xarid uchun hisobga kirish kerak. Ilovani qayta oching.</p>}
              <footer className="checkout-footer">
                <div>
                  <span className="muted">{t('Jami')}</span>
                  <strong>{price || 'Paket tanlanmagan'}</strong>
                </div>
                <button className="button primary" type="submit" disabled={!product || !authenticated || !playerId.trim() || (needsZone && !zoneId.trim())}>
                  {t('Davom etish')} <ArrowRight size={18} />
                </button>
              </footer>
            </form>
          ) : (
            <div className="checkout-form checkout-view view-forward review-step">
              <button type="button" className="checkout-back" onClick={() => setStep('details')}>
                <ArrowLeft size={17} />
                {t("Hisob ma'lumotlariga qaytish")}
              </button>
              <div className="review-heading">
                <span className="eyebrow accent-text">3-QADAM</span>
                <h3>{t('Buyurtmani tasdiqlang')}</h3>
                <p>{t("To'lashdan oldin ma'lumotlarni yana bir marta tekshiring.")}</p>
              </div>
              <dl className="receipt">
                <div>
                  <dt>{t('Paket')}</dt>
                  <dd>{product?.name}</dd>
                </div>
                <div>
                  <dt>{accountLabel}</dt>
                  <dd>{playerId}</dd>
                </div>
                {needsZone && (
                  <div>
                    <dt>Zone ID</dt>
                    <dd>{zoneId}</dd>
                  </div>
                )}
                {server && (
                  <div>
                    <dt>{t('Hudud')}</dt>
                    <dd>{servers.find((s) => s.code === server)?.name}</dd>
                  </div>
                )}
                <div className="receipt-total">
                  <dt>{t('Jami')}</dt>
                  <dd>{price}</dd>
                </div>
              </dl>
              <p className="notice">
                <ShieldCheck size={19} />
                {t("O'yin ID va hududni tekshiring. Paket shu hisobga yuboriladi.")}
              </p>
              {wallet && wallet.balanceMinor < (product?.amountMinor ?? 0) && <ErrorBox message={t("Balans yetarli emas. Profil bo'limida hisobingizni to'ldiring.")} locale={locale} />}
              {error && <ErrorBox message={error} locale={locale} />}
              <button className="button primary full-width" disabled={busy || !wallet || wallet.balanceMinor < (product?.amountMinor ?? 0)} onClick={pay}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
                {busy ? t('Kutilmoqda...') : locale === 'ru' ? `Оплатить ${price}` : `${price} to'lash`}
              </button>
              <button className="button subtle full-width" disabled={busy} onClick={() => setStep('details')}>
                {t("Ma'lumotlarni o'zgartirish")}
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
