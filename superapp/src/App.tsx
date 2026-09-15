import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, Clock3, Copy, Gamepad2, Headphones, LoaderCircle, Moon, Package, Plus, RefreshCw, Search, ShieldCheck, Star, Sun, UserRound, Wallet as WalletIcon, X } from 'lucide-react';
import type { AppConfig, Game, Order, Session, TopUp, User, Wallet } from './types';
import { api, errorText, login, signIn } from './services/api';
import { haptic, inTelegram, openTelegram, telegram } from './services/telegram';
import { Checkout } from './components/Checkout';
import { WalletSheet } from './components/WalletSheet';
import { Sheet } from './components/Sheet';
import { date, ErrorBox, GameCard, money, statuses } from './components/ui';

type Tab = 'shop' | 'orders' | 'profile';
const defaultConfig: AppConfig = { supportUrl: 'https://t.me/The_Anonimous_uzb', telegramBotUrl: 'https://t.me/uzdonate1bot', telegramPaymentsEnabled: false };

export default function App() {
  const [tab, setTab] = useState<Tab>('shop');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [game, setGame] = useState<Game | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('uzdonate_theme') || 'dark'; } catch { return 'dark'; }
  });
  const accountLoading = useRef(false);
  const tg = inTelegram();

  const refreshAccount = useCallback(async () => {
    if (accountLoading.current) return;
    accountLoading.current = true; setRefreshing(true);
    try {
      const result = await Promise.all([
        api<{ orders: Order[] }>('/orders?limit=50'),
        inTelegram() ? Promise.resolve(null) : api<Wallet>('/wallet'),
        inTelegram() ? Promise.resolve({ topUps: [] as TopUp[] }) : api<{ topUps: TopUp[] }>('/topups?limit=20'),
      ]);
      setOrders(result[0].orders); setWallet(result[1]); setTopups(result[2].topUps); setAccountError('');
    } catch (err) { setAccountError(errorText(err)); }
    finally { accountLoading.current = false; setRefreshing(false); }
  }, []);
  const loadCatalog = useCallback(async () => {
    setLoading(true); setCatalogError('');
    try { setGames((await api<{ games: Game[] }>('/games', undefined, false)).games); }
    catch (err) { setCatalogError(errorText(err)); }
    finally { setLoading(false); }
  }, []);
  const authenticate = useCallback(async () => {
    setAccountError('');
    try { const session = await signIn(); setUser(session.user); await refreshAccount(); }
    catch (err) { setAccountError(errorText(err)); }
  }, [refreshAccount]);
  useEffect(() => {
    telegram()?.ready(); telegram()?.expand();
    void loadCatalog(); void authenticate();
    api<AppConfig>('/app/config', undefined, false).then(setConfig).catch(() => {});
  }, [loadCatalog, authenticate]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('uzdonate_theme', theme); } catch { /* Optional preference. */ }
    telegram()?.setHeaderColor(theme === 'dark' ? '#101214' : '#f5f6f8');
    telegram()?.setBackgroundColor(theme === 'dark' ? '#101214' : '#f5f6f8');
  }, [theme]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (!document.hidden) void refreshAccount(); };
    const interval = window.setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [user, refreshAccount]);

  function navigate(next: Tab) { setTab(next); haptic(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  const categories = [...new Set(games.map((item) => item.category).filter(Boolean))] as string[];
  const filtered = games.filter((item) => (!onlyAvailable || item.isPurchasable) &&
    (category === 'all' || item.category === category) && `${item.name} ${item.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  const activeOrders = orders.filter((item) => ['PENDING', 'PAID', 'PROCESSING'].includes(item.status));
  const filteredOrders = orderFilter === 'all' ? orders : orderFilter === 'active' ? activeOrders : orders.filter((item) => !['PENDING', 'PAID', 'PROCESSING'].includes(item.status));
  const navigation = [{ id: 'shop' as const, icon: Gamepad2, label: "Do'kon" }, { id: 'orders' as const, icon: Package, label: 'Buyurtmalar' }, { id: 'profile' as const, icon: UserRound, label: 'Profil' }];

  return <div className="app-shell">
    <header className="app-header"><div className="header-inner">
      <button className="brand" onClick={() => navigate('shop')} aria-label="UZDONATE bosh sahifa"><img src="assets-store/brand.png" alt=""/><span>UZDONATE<span className="brand-dot">.</span></span></button>
      <nav className="desktop-nav" aria-label="Asosiy bo'limlar">{navigation.map(({ id, icon: Icon, label }) => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="header-actions"><button className="icon-button" title={theme === 'dark' ? "Yorug' mavzu" : "Qorong'i mavzu"} aria-label="Mavzuni almashtirish" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
      <button className="avatar" title="Profil" aria-label="Profil" onClick={() => navigate('profile')}>{user?.displayName?.slice(0, 1).toUpperCase() || <UserRound size={19}/>}</button></div>
    </div></header>

    <main className="main-content">
      {config.testMode && <p className="eyebrow accent-text" role="status">Sinov muhiti</p>}
      {tab === 'shop' && <>
        <section className="store-heading"><div><span className="eyebrow accent-text">PLAY MORE</span><h1>O'yiningiz davom etsin.</h1><p>UC, olmoslar, o'yin valyutalari va obunalar.</p></div>
          {tg ? <div className="payment-indicator"><Star size={23}/><div><strong>Telegram Stars</strong><span>Telegram ichida xarid</span></div></div> : <button className="wallet-summary" onClick={() => setShowWallet(true)}><WalletIcon size={23}/><div><span>Mening balansim</span><strong>{wallet ? money(wallet.balanceMinor, wallet.currency) : '...'}</strong></div><Plus size={20}/></button>}
        </section>
        {accountError && <ErrorBox message={accountError} retry={() => void authenticate()}/>}
        {activeOrders.length > 0 && <button className="activity-strip" onClick={() => navigate('orders')}><Clock3 size={18}/><span>{activeOrders.length} ta buyurtmangiz jarayonda</span><ArrowRight size={18}/></button>}
        <section aria-label="Katalog">
          <div className="catalog-toolbar"><h2>O'yinlar va xizmatlar <span className="count">{games.length}</span></h2><label className="search-field"><Search size={20}/><input aria-label="O'yin qidirish" placeholder="O'yin qidirish" value={query} onChange={(event) => setQuery(event.target.value)}/>{query && <button className="icon-button small" title="Qidiruvni tozalash" aria-label="Qidiruvni tozalash" onClick={() => setQuery('')}><X size={16}/></button>}</label></div>
          <div className="catalog-filters"><div className="category-strip" aria-label="Kategoriyalar"><button className={`chip ${category === 'all' ? 'active' : ''}`} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Barchasi</button>{categories.map((item) => <button key={item} className={`chip ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
          <div className="catalog-meta"><span>{loading ? 'Katalog yuklanmoqda' : `${filtered.length} ta natija`}</span><label className="toggle-label"><input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)}/>Faqat mavjudlar</label></div>
          {catalogError ? <ErrorBox message={catalogError} retry={() => void loadCatalog()}/> : loading ? <div className="games-grid" aria-label="Katalog yuklanmoqda" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="game-skeleton skeleton"/>)}</div> : filtered.length ? <div className="games-grid">{filtered.map((item) => <GameCard key={item.id} game={item} onSelect={(selected) => { haptic(); setGame(selected); }}/>)}</div> : <div className="empty-state"><Search size={35}/><h3>O'yin topilmadi</h3><p>Boshqa nom yoki kategoriyani tanlang.</p><button className="button secondary" onClick={() => { setQuery(''); setCategory('all'); setOnlyAvailable(false); }}>Filtrlarni tozalash</button></div>}
        </section>
        <section className="support-band"><div><Headphones size={25}/><div><h3>Yordam kerakmi?</h3><p>Buyurtma yoki to'lov bo'yicha bizga yozing.</p></div></div><button className="button secondary" onClick={() => openTelegram(config.supportUrl)}>Bog'lanish <ArrowUpRight size={17}/></button></section>
      </>}

      {tab === 'orders' && <>
        <div className="page-heading"><div><span className="eyebrow accent-text">BUYURTMALARIM</span><h1>Xaridlar tarixi</h1></div><button className="icon-button" title="Yangilash" aria-label="Buyurtmalarni yangilash" disabled={refreshing} onClick={() => void refreshAccount()}><RefreshCw size={20} className={refreshing ? 'spin' : ''}/></button></div>
        <div className="tabs">{[{ id: 'all', label: 'Barchasi' }, { id: 'active', label: 'Jarayonda' }, { id: 'done', label: 'Yakunlangan' }].map((item) => <button className={orderFilter === item.id ? 'active' : ''} aria-pressed={orderFilter === item.id} key={item.id} onClick={() => setOrderFilter(item.id)}>{item.label}</button>)}</div>
        {accountError && <ErrorBox message={accountError} retry={() => void authenticate()}/>}
        {refreshing && !orders.length ? <div className="skeleton list-skeleton"/> : filteredOrders.length ? <div className="orders-list">{filteredOrders.map((item) => <button className="order-row" key={item.id} onClick={() => setOrder(item)}><div className={`order-icon ${item.status === 'COMPLETED' ? 'complete' : ''}`}>{item.status === 'COMPLETED' ? <CheckCircle2 size={23}/> : <Package size={23}/>}</div><div className="order-description"><strong>{item.game.name}</strong><span>{item.items[0]?.productName}</span><small>{date(item.createdAt)} · #{item.orderNumber}</small></div><div className="order-value"><strong>{money(item.amountMinor, item.currency)}</strong><span className={`status status-${item.status.toLowerCase()}`}>{statuses[item.status]}</span></div><ChevronRight className="row-chevron" size={18}/></button>)}</div> : <div className="empty-state"><Package size={40}/><h3>Hozircha buyurtmalar yo'q</h3><p>Xaridlaringiz shu yerda ko'rinadi.</p><button className="button primary" onClick={() => navigate('shop')}>Do'konga o'tish <ArrowRight size={18}/></button></div>}
      </>}

      {tab === 'profile' && <>
        <div className="page-heading"><div><span className="eyebrow accent-text">SHAXSIY KABINET</span><h1>Mening profilim</h1></div></div>
        <section className="profile-identity"><div className="profile-avatar">{user?.displayName?.slice(0, 1).toUpperCase() || <UserRound size={35}/>}</div><div><h2>{user?.displayName || 'Mehmon'}</h2><span className="muted">{user?.publicId || 'Hisobga ulanmoqda...'}</span></div>{user && <button className="icon-button" title="ID nusxalash" aria-label="ID nusxalash" onClick={() => navigator.clipboard.writeText(user.publicId).catch(() => {})}><Copy size={18}/></button>}</section>
        {accountError && <ErrorBox message={accountError} retry={() => void authenticate()}/>}
        {!tg && <section className="profile-wallet"><div><WalletIcon size={23}/><span>Mening balansim</span></div><strong>{wallet ? money(wallet.balanceMinor, wallet.currency) : '...'}</strong><button className="button primary" disabled={!user} onClick={() => setShowWallet(true)}><Plus size={18}/>Balansni to'ldirish</button></section>}
        <div className="profile-links">
          <button onClick={() => navigate('orders')}><Package size={21}/><span>Buyurtmalarim</span><span className="muted">{orders.length}</span><ChevronRight size={18}/></button>
          {!tg && <button onClick={() => setShowLogin(true)}><UserRound size={21}/><span>{user?.isGuest ? 'Mavjud hisobga kirish' : 'Boshqa hisobga kirish'}</span><ChevronRight size={18}/></button>}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Moon size={21}/><span>Tashqi ko'rinish</span><span className="muted">{theme === 'dark' ? "Qorong'i" : "Yorug'"}</span><ChevronRight size={18}/></button>
          <button onClick={() => openTelegram(config.supportUrl)}><Headphones size={21}/><span>Yordam xizmati</span><ArrowUpRight size={18}/></button>
          <a href="terms.html" target="_blank" rel="noreferrer"><ShieldCheck size={21}/><span>Foydalanish shartlari</span><ArrowUpRight size={18}/></a>
          <a href="privacy.html" target="_blank" rel="noreferrer"><ShieldCheck size={21}/><span>Maxfiylik siyosati</span><ArrowUpRight size={18}/></a>
        </div>
        {!tg && topups.length > 0 && <section className="topup-history"><h2>Balans to'ldirish tarixi</h2>{topups.map((item) => <div key={item.id} className="history-row"><div><strong>{money(item.amountMinor)}</strong><small>{date(item.createdAt)}</small></div><span className={`status ${item.status === 'VERIFIED' ? 'status-completed' : ''}`}>{{ VERIFIED: 'Tasdiqlandi', PENDING: 'Tekshirilmoqda', REJECTED: 'Rad etildi', EXPIRED: 'Muddat tugadi' }[item.status] || item.status}</span></div>)}</section>}
      </>}
      <footer className="app-footer"><span>UZDONATE</span><span>O'yiningiz bilan birga.</span><a href="privacy.html" target="_blank" rel="noreferrer">Maxfiylik</a></footer>
    </main>
    <nav className="bottom-nav" aria-label="Asosiy bo'limlar">{navigation.map(({ id, icon: Icon, label }) => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}><span><Icon size={22}/>{id === 'orders' && activeOrders.length > 0 && <i/>}</span>{label}</button>)}</nav>
    {game && <Checkout key={game.id} game={game} authenticated={Boolean(user)} wallet={wallet} onClose={() => setGame(null)} onUpdated={refreshAccount}/>}
    {showWallet && !tg && <WalletSheet onClose={() => setShowWallet(false)} onUpdated={refreshAccount}/>}
    {showLogin && <LoginSheet onClose={() => setShowLogin(false)} onLogin={(session) => { setUser(session.user); setShowLogin(false); void refreshAccount(); }}/>} 
    {order && <OrderSheet order={orders.find((item) => item.id === order.id) || order} onClose={() => setOrder(null)} onUpdated={refreshAccount} supportUrl={config.supportUrl}/>}
  </div>;
}

function LoginSheet({ onClose, onLogin }: { onClose: () => void; onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { onLogin(await login(email.trim(), password)); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return <Sheet title="Hisobga kirish" onClose={onClose} busy={busy}><form className="checkout-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)}/></label><label>Parol<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}/></label>{error && <ErrorBox message={error}/>}<button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <ArrowRight size={18}/>}Kirish</button></form></Sheet>;
}

function OrderSheet({ order, onClose, onUpdated, supportUrl }: { order: Order; onClose: () => void; onUpdated: () => void; supportUrl: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function resume() {
    if (busy) return; setBusy(true); setError('');
    try {
      if (order.currency === 'XTR') {
        if (!inTelegram()) throw new Error('Telegram required');
        const invoice = await api<{ invoiceUrl: string }>(`/telegram/invoices/${order.id}`, {});
        await new Promise((resolve) => telegram()!.openInvoice(invoice.invoiceUrl, resolve));
      } else await api('/payments/wallet', { orderId: order.id, idempotencyKey: `wallet:${order.id}` });
      onUpdated();
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return <Sheet title={`Buyurtma #${order.orderNumber}`} onClose={onClose} busy={busy}><div className="checkout-form"><span className={`status status-${order.status.toLowerCase()}`}>{statuses[order.status]}</span><h3>{order.game.name}</h3><dl className="receipt"><div><dt>Paket</dt><dd>{order.items[0]?.productName}</dd></div><div><dt>Player ID</dt><dd>{order.playerId}</dd></div>{order.zoneId && <div><dt>Zone ID</dt><dd>{order.zoneId}</dd></div>}<div><dt>Sana</dt><dd>{date(order.createdAt)}</dd></div><div className="receipt-total"><dt>Jami</dt><dd>{money(order.amountMinor, order.currency)}</dd></div></dl>{order.failureReason && <p className="notice">Buyurtma bajarilmadi. Yordam xizmati bilan bog'laning.</p>}{error && <ErrorBox message={error}/>} {order.status === 'PENDING' && <button className="button primary" disabled={busy} onClick={resume}>{busy ? <LoaderCircle size={18} className="spin"/> : <ArrowRight size={18}/>}To'lovni davom ettirish</button>}<button className="button secondary" onClick={() => openTelegram(supportUrl)}><Headphones size={18}/>Buyurtma bo'yicha yordam</button></div></Sheet>;
}
