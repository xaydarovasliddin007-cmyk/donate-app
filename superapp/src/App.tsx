import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Bell, CheckCircle2, ChevronRight, Clock3, Copy, Gamepad2, Headphones, Home, LoaderCircle, Moon, Package, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Sun, UserRound, Wallet as WalletIcon, X } from 'lucide-react';
import type { AppConfig, AppNotification, Game, Order, SavedGame, Session, TopUp, User, Wallet } from './types';
import { api, errorText, login, signIn } from './services/api';
import { haptic, inTelegram, openTelegram, telegram } from './services/telegram';
import { Checkout } from './components/Checkout';
import { WalletSheet } from './components/WalletSheet';
import { Sheet } from './components/Sheet';
import { date, ErrorBox, GameCard, money, statuses } from './components/ui';
import { tr, type Locale } from './i18n';

type Tab = 'shop' | 'games' | 'orders' | 'profile';
const defaultConfig: AppConfig = { supportUrl: 'https://t.me/The_Anonimous_uzb', telegramBotUrl: 'https://t.me/uzdonate1bot', telegramPaymentsEnabled: false };

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem('uzdonate_locale');
      if (saved === 'uz' || saved === 'ru') return saved;
    } catch { /* Storage may be unavailable in a webview. */ }
    return telegram()?.initDataUnsafe?.user?.language_code?.startsWith('ru') ? 'ru' : 'uz';
  });
  const t = (text: string) => tr(locale, text);
  const [tab, setTab] = useState<Tab>('shop');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [game, setGame] = useState<Game | null>(null);
  const [quickProfile, setQuickProfile] = useState<SavedGame | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('uzdonate_theme') || 'dark'; } catch { return 'dark'; }
  });
  const accountLoading = useRef(false);
  const tg = inTelegram();
  const carouselGames = ['mobile-legends', 'pubg-mobile', 'free-fire']
    .map((slug) => games.find((item) => item.slug === slug))
    .filter((item): item is Game => Boolean(item));

  const refreshAccount = useCallback(async () => {
    if (accountLoading.current) return;
    accountLoading.current = true; setRefreshing(true);
    try {
      const result = await Promise.all([
        api<{ orders: Order[] }>('/orders?limit=50'),
        api<Wallet>('/wallet'),
        api<{ topUps: TopUp[] }>('/topups?limit=20'),
        api<{ savedGames: SavedGame[] }>('/saved-games').catch(() => ({ savedGames: [] })),
        api<{ notifications: AppNotification[]; unreadCount: number }>('/notifications?limit=30').catch(() => ({ notifications: [], unreadCount: 0 })),
      ]);
      setOrders(result[0].orders); setWallet(result[1]); setTopups(result[2].topUps); setSavedGames(result[3].savedGames); setNotifications(result[4].notifications); setUnreadNotifications(result[4].unreadCount); setAccountError('');
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
    try { const session = await signIn(locale); setUser(session.user); await refreshAccount(); }
    catch (err) { setAccountError(errorText(err)); }
  }, [refreshAccount, locale]);
  useEffect(() => {
    telegram()?.ready(); telegram()?.expand();
    void loadCatalog(); void authenticate();
    api<AppConfig>('/app/config', undefined, false).then(setConfig).catch(() => {});
  }, [loadCatalog, authenticate]);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 2200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('uzdonate_theme', theme); } catch { /* Optional preference. */ }
    telegram()?.setHeaderColor(theme === 'dark' ? '#070912' : '#f3f5fa');
    telegram()?.setBackgroundColor(theme === 'dark' ? '#070912' : '#f3f5fa');
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem('uzdonate_locale', locale); } catch { /* Optional preference. */ }
    document.documentElement.lang = locale;
    document.title = locale === 'ru' ? 'UZDONATE | Магазин игр' : "UZDONATE | O'yinlar do'koni";
  }, [locale]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (!document.hidden) void refreshAccount(); };
    const interval = window.setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [user, refreshAccount]);
  useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);
  useEffect(() => {
    if (carouselGames.length < 2) return;
    const timer = window.setInterval(() => setBannerIndex((index) => (index + 1) % carouselGames.length), 4500);
    return () => clearInterval(timer);
  }, [games]);

  function navigate(next: Tab) { setTab(next); haptic(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function openGame(selected: Game, profile: SavedGame | null = null) { setQuickProfile(profile); setGame(selected); haptic(); }
  async function markNotificationRead(item: AppNotification) {
    if (item.readAt) return;
    await api(`/notifications/${item.id}/read`, {});
    setUnreadNotifications((count) => Math.max(0, count - 1));
    setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
  }
  async function markAllNotificationsRead() {
    await api('/notifications/read-all', {});
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadNotifications(0);
  }
  function openNotification(item: AppNotification) {
    const prefix = '/orders/';
    if (!item.deepLink?.startsWith(prefix)) return;
    const linkedOrder = orders.find((entry) => entry.id === item.deepLink!.slice(prefix.length));
    if (linkedOrder) { setOrder(linkedOrder); setShowNotifications(false); }
    else { setShowNotifications(false); navigate('orders'); }
  }
  function showCatalog() { navigate('games'); }
  const categories = [...new Set(games.map((item) => item.category).filter(Boolean))] as string[];
  const filtered = games.filter((item) => (!onlyAvailable || item.isPurchasable) &&
    (category === 'all' || item.category === category) && `${item.name} ${item.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  const activeOrders = orders.filter((item) => ['PENDING', 'PAID', 'PROCESSING'].includes(item.status));
  const filteredOrders = orderFilter === 'all' ? orders : orderFilter === 'active' ? activeOrders : orders.filter((item) => !['PENDING', 'PAID', 'PROCESSING'].includes(item.status));
  const navigation = [{ id: 'shop' as const, icon: Home, label: t('Asosiy') }, { id: 'games' as const, icon: Gamepad2, label: t("O'yinlar") }, { id: 'orders' as const, icon: Package, label: t('Buyurtmalar') }, { id: 'profile' as const, icon: UserRound, label: t('Profil') }];
  const featuredGame = carouselGames[bannerIndex % Math.max(carouselGames.length, 1)] || games.find((item) => item.isPurchasable);
  const featuredCopy: Record<string, string> = {
    'mobile-legends': 'Olmoslarni tez va xavfsiz xarid qiling.',
    'pubg-mobile': 'UC paketlari eng qulay narxlarda.',
    'free-fire': 'Diamond paketlari bir necha bosishda.',
  };

  return <><div className={`app-shell ${showIntro ? 'app-preparing' : 'app-ready'}`}>
    <header className="app-header"><div className="header-inner">
      <button className="brand" onClick={() => navigate('shop')} aria-label="UZDONATE bosh sahifa"><img src="assets-store/brand.png" alt=""/><span>UZDONATE<span className="brand-dot">.</span></span></button>
      <nav className="desktop-nav" aria-label={t('Asosiy bo\'limlar')}>{navigation.map(({ id, icon: Icon, label }) => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="header-actions"><button className="locale-toggle" aria-label={locale === 'uz' ? 'Русский язык' : "O'zbek tili"} onClick={() => setLocale(locale === 'uz' ? 'ru' : 'uz')}>{locale === 'uz' ? 'RU' : 'UZ'}</button><button className="icon-button" title={t(theme === 'dark' ? "Yorug' mavzu" : "Qorong'i mavzu")} aria-label={t('Mavzuni almashtirish')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
      {user && <button className="icon-button notification-trigger" title={t('Bildirishnomalar')} aria-label={`${t('Bildirishnomalar')}${unreadNotifications ? `, ${unreadNotifications}` : ''}`} onClick={() => setShowNotifications(true)}><Bell size={20}/>{unreadNotifications > 0 && <i>{unreadNotifications > 9 ? '9+' : unreadNotifications}</i>}</button>}
      <button className="avatar" title={t('Profil')} aria-label={t('Profil')} onClick={() => navigate('profile')}>{user?.avatarUrl && !avatarFailed ? <img src={user.avatarUrl} alt="" onError={() => setAvatarFailed(true)}/> : user?.displayName?.slice(0, 1).toUpperCase() || <UserRound size={19}/>}</button></div>
    </div></header>

    <main className="main-content">
      {config.testMode && <p className="eyebrow accent-text" role="status">{t('Sinov muhiti')}</p>}
      <div className="tab-view" key={tab}>
      {tab === 'shop' && <>
        <section className="store-heading">
          <div className="welcome-row">
            <button className="welcome-avatar" onClick={() => navigate('profile')} aria-label="Profilni ochish">{user?.avatarUrl && !avatarFailed ? <img src={user.avatarUrl} alt="" onError={() => setAvatarFailed(true)}/> : user?.displayName?.slice(0, 1).toUpperCase() || <UserRound size={24}/>}</button>
            <div><span className="eyebrow">{t('Xush kelibsiz')}</span><h1>{user?.displayName || t('UZDONATE foydalanuvchisi')}</h1></div>
          </div>
          <div className="wallet-summary"><WalletIcon size={25}/><div><span>{locale === 'ru' ? 'БАЛАНС' : 'BALANS'}</span><strong>{wallet ? money(wallet.balanceMinor, wallet.currency, locale) : '...'}</strong></div><button className="wallet-action" onClick={() => setShowWallet(true)}><Plus size={17}/> {t("To'ldirish")}</button></div>
        </section>
        {accountError && <ErrorBox message={accountError} retry={() => void authenticate()} locale={locale}/>}
        {activeOrders.length > 0 && <button className="activity-strip" onClick={() => navigate('orders')}><Clock3 size={18}/><span>{activeOrders.length} {t('ta buyurtmangiz jarayonda')}</span><ArrowRight size={18}/></button>}
        <section className="quick-actions" aria-label={t('Tezkor amallar')}>
          <button onClick={() => setShowWallet(true)}><span><WalletIcon size={21}/></span><strong>{t("Balans to'ldirish")}</strong><ChevronRight size={17}/></button>
          <button onClick={() => openTelegram(config.supportUrl)}><span><Headphones size={21}/></span><strong>{t('Yordam')}</strong><ChevronRight size={17}/></button>
        </section>
        {savedGames.some((profile) => profile.game.isPurchasable) && <section className="saved-games-section"><div className="catalog-toolbar"><div><span className="eyebrow accent-text">{t('SAQLANGAN O\'YINLAR')}</span><h2>{t('Mening o\'yinlarim')}</h2></div></div><div className="saved-games-list">{savedGames.filter((profile) => profile.game.isPurchasable).map((profile) => <button className="saved-game-row" key={profile.id} onClick={() => openGame(profile.game, profile)}>{profile.game.logoUrl ? <img className="saved-game-logo" src={profile.game.logoUrl} alt=""/> : <span className="saved-game-logo saved-game-fallback"><Gamepad2 size={22}/></span>}<span className="saved-game-details"><strong>{profile.game.name}</strong><small>{t('Player ID')}: {profile.playerId}{profile.zoneId ? ` · ${t('Zone ID')}: ${profile.zoneId}` : ''}</small><span>{t('Tezkor xarid')} <ArrowRight size={15}/></span></span></button>)}</div></section>}
        {featuredGame && <button className="featured-banner" onClick={() => { haptic(); setGame(featuredGame); }}>
          <div className="featured-copy"><span><Sparkles size={14}/> {t('TEZKOR TOP-UP')}</span><h2>{featuredGame.name}</h2><p>{t(featuredCopy[featuredGame.slug] || "Eng yaxshi narxlar va tezkor yetkazib berish.")}</p><strong>{t('Xaridni boshlash')} <ArrowRight size={17}/></strong></div>
          {featuredGame.logoUrl && <img src={featuredGame.logoUrl} alt=""/>}
          {carouselGames.length > 1 && <span className="banner-dots" aria-label="Bannerlar">{carouselGames.map((item, index) => <i key={item.id} className={index === bannerIndex % carouselGames.length ? 'active' : ''}/>)}</span>}
        </button>}
        <section id="catalog" className="home-catalog" aria-label="Mashhur o'yinlar">
          <div className="catalog-toolbar"><div><span className="eyebrow accent-text">{t('KATALOG')}</span><h2>{t("Mashhur o'yinlar")}</h2></div><button className="catalog-all" onClick={showCatalog}>{t('Barchasi')} <ArrowRight size={17}/></button></div>
          {catalogError ? <ErrorBox message={catalogError} retry={() => void loadCatalog()} locale={locale}/> : loading ? <div className="games-grid" aria-label={t('Katalog yuklanmoqda')} aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="game-skeleton skeleton"/>)}</div> : <div className="games-grid">{games.filter((item) => item.isPurchasable).slice(0, 8).map((item) => <GameCard key={item.id} game={item} locale={locale} onSelect={(selected) => { haptic(); setGame(selected); }}/>)}</div>}
        </section>
        <section className="support-band"><div><Headphones size={25}/><div><h3>{t('Yordam kerakmi?')}</h3><p>{t("Buyurtma yoki to'lov bo'yicha bizga yozing.")}</p></div></div><button className="button secondary" onClick={() => openTelegram(config.supportUrl)}>{t("Bog'lanish")} <ArrowUpRight size={17}/></button></section>
      </>}

      {tab === 'games' && <>
        <div className="page-heading games-heading"><div><span className="eyebrow accent-text">{t("Barcha o'yinlar")}</span><h1>{t("O'yinni tanlang")}</h1></div><span className="count">{games.length}</span></div>
        <section aria-label="O'yinlar katalogi">
          <label className="search-field games-search"><Search size={19}/><input aria-label={t("O'yin qidirish")} placeholder={t("O'yin qidirish")} value={query} onChange={(event) => setQuery(event.target.value)}/>{query && <button className="icon-button small" title={t('Qidiruvni tozalash')} aria-label={t('Qidiruvni tozalash')} onClick={() => setQuery('')}><X size={16}/></button>}</label>
          <div className="catalog-filters"><div className="category-strip" aria-label={t('Kategoriyalar')}><button className={`chip ${category === 'all' ? 'active' : ''}`} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>{t('Barchasi')}</button>{categories.map((item) => <button key={item} className={`chip ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{t(item)}</button>)}</div></div>
          <div className="catalog-meta"><span>{loading ? t('Katalog yuklanmoqda') : locale === 'ru' ? `${filtered.length} результатов` : `${filtered.length} ta natija`}</span><label className="toggle-label"><input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)}/>{t('Faqat mavjudlar')}</label></div>
          {catalogError ? <ErrorBox message={catalogError} retry={() => void loadCatalog()} locale={locale}/> : loading ? <div className="games-grid all-games-grid" aria-label={t('Katalog yuklanmoqda')} aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="game-skeleton skeleton"/>)}</div> : filtered.length ? <div className="games-grid all-games-grid">{filtered.map((item) => <GameCard key={item.id} game={item} locale={locale} onSelect={(selected) => { haptic(); setGame(selected); }}/>)}</div> : <div className="empty-state"><Search size={35}/><h3>{t("O'yin topilmadi")}</h3><p>{t('Boshqa nom yoki kategoriyani tanlang.')}</p><button className="button secondary" onClick={() => { setQuery(''); setCategory('all'); setOnlyAvailable(false); }}>{t('Filtrlarni tozalash')}</button></div>}
        </section>
      </>}

      {tab === 'orders' && <>
        <div className="page-heading"><div><span className="eyebrow accent-text">{t('BUYURTMALARIM')}</span><h1>{t('Xaridlar tarixi')}</h1></div><button className="icon-button" title={t('Yangilash')} aria-label={locale === 'ru' ? 'Обновить заказы' : 'Buyurtmalarni yangilash'} disabled={refreshing} onClick={() => void refreshAccount()}><RefreshCw size={20} className={refreshing ? 'spin' : ''}/></button></div>
        <div className="tabs">{[{ id: 'all', label: t('Barchasi') }, { id: 'active', label: t('Jarayonda') }, { id: 'done', label: t('Yakunlangan') }].map((item) => <button className={orderFilter === item.id ? 'active' : ''} aria-pressed={orderFilter === item.id} key={item.id} onClick={() => setOrderFilter(item.id)}>{item.label}</button>)}</div>
        {accountError && <ErrorBox message={accountError} retry={() => void authenticate()}/>}
        {refreshing && !orders.length ? <div className="skeleton list-skeleton"/> : filteredOrders.length ? <div className="orders-list">{filteredOrders.map((item) => <button className="order-row" key={item.id} onClick={() => setOrder(item)}><div className={`order-icon ${item.status === 'COMPLETED' ? 'complete' : ''}`}>{item.status === 'COMPLETED' ? <CheckCircle2 size={23}/> : <Package size={23}/>}</div><div className="order-description"><strong>{item.game.name}</strong><span>{item.items[0]?.productName}</span><small>{date(item.createdAt, locale)} · #{item.orderNumber}</small></div><div className="order-value"><strong>{money(item.amountMinor, item.currency, locale)}</strong><span className={`status status-${item.status.toLowerCase()}`}>{locale === 'ru' ? ({ PENDING: 'Ожидает оплаты', PAID: 'Оплачен', PROCESSING: 'В обработке', COMPLETED: 'Выполнен', FAILED: 'Ошибка', CANCELLED: 'Отменён', REFUNDED: 'Возвращён' } as Record<string, string>)[item.status] : statuses[item.status]}</span></div><ChevronRight className="row-chevron" size={18}/></button>)}</div> : <div className="empty-state"><Package size={40}/><h3>{t("Hozircha buyurtmalar yo'q")}</h3><p>{t("Xaridlaringiz shu yerda ko'rinadi.")}</p><button className="button primary" onClick={() => navigate('shop')}>{t("Do'konga o'tish")} <ArrowRight size={18}/></button></div>}
      </>}

      {tab === 'profile' && <>
        <div className="page-heading"><div><span className="eyebrow accent-text">{t('SHAXSIY KABINET')}</span><h1>{t('Mening profilim')}</h1></div></div>
        <section className="profile-identity"><div className="profile-avatar">{user?.avatarUrl && !avatarFailed ? <img src={user.avatarUrl} alt="" onError={() => setAvatarFailed(true)}/> : user?.displayName?.slice(0, 1).toUpperCase() || <UserRound size={35}/>}</div><div><h2>{user?.displayName || t('Mehmon')}</h2><span className="muted">{user?.publicId || t('Hisobga ulanmoqda...')}</span></div>{user && <button className="icon-button" title={t('ID nusxalash')} aria-label={t('ID nusxalash')} onClick={() => navigator.clipboard.writeText(user.publicId).catch(() => {})}><Copy size={18}/></button>}</section>
        {accountError && <ErrorBox message={accountError} retry={() => void authenticate()}/>}
        <section className="profile-wallet"><div><WalletIcon size={23}/><span>{t('Mening balansim')}</span></div><strong>{wallet ? money(wallet.balanceMinor, wallet.currency) : '...'}</strong><button className="button primary" disabled={!user} onClick={() => setShowWallet(true)}><Plus size={18}/>{t("Balansni to'ldirish")}</button></section>
        <div className="profile-links">
          <button onClick={() => navigate('orders')}><Package size={21}/><span>{t('Buyurtmalarim')}</span><span className="muted">{orders.length}</span><ChevronRight size={18}/></button>
          {!tg && <button onClick={() => setShowLogin(true)}><UserRound size={21}/><span>{t(user?.isGuest ? 'Mavjud hisobga kirish' : 'Boshqa hisobga kirish')}</span><ChevronRight size={18}/></button>}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Moon size={21}/><span>{t("Tashqi ko'rinish")}</span><span className="muted">{t(theme === 'dark' ? "Qorong'i" : "Yorug'")}</span><ChevronRight size={18}/></button>
          <button onClick={() => openTelegram(config.supportUrl)}><Headphones size={21}/><span>{t('Yordam xizmati')}</span><ArrowUpRight size={18}/></button>
          <a href="terms.html" target="_blank" rel="noreferrer"><ShieldCheck size={21}/><span>{t('Foydalanish shartlari')}</span><ArrowUpRight size={18}/></a>
          <a href="privacy.html" target="_blank" rel="noreferrer"><ShieldCheck size={21}/><span>{t('Maxfiylik siyosati')}</span><ArrowUpRight size={18}/></a>
        </div>
        {topups.length > 0 && <section className="topup-history"><h2>{t("Balans to'ldirish tarixi")}</h2>{topups.map((item) => <div key={item.id} className="history-row"><div><strong>{money(item.amountMinor, 'UZS', locale)}</strong><small>{date(item.createdAt, locale)}</small></div><span className={`status ${item.status === 'VERIFIED' ? 'status-completed' : ''}`}>{t(({ VERIFIED: 'Tasdiqlandi', PENDING: 'Tekshirilmoqda', REJECTED: 'Rad etildi', EXPIRED: 'Muddat tugadi' } as Record<string, string>)[item.status] || item.status)}</span></div>)}</section>}
      </>}
      </div>
      <footer className="app-footer"><span>UZDONATE</span><span>{t("O'yiningiz bilan birga.")}</span><a href="privacy.html" target="_blank" rel="noreferrer">{t('Maxfiylik')}</a></footer>
    </main>
    <nav className="bottom-nav" aria-label={t("Asosiy bo'limlar")}>
      <button aria-current={tab === 'shop' ? 'page' : undefined} className={tab === 'shop' ? 'active' : ''} onClick={() => navigate('shop')}><span><Home size={21}/></span>{t('Asosiy')}</button>
      <button aria-current={tab === 'games' ? 'page' : undefined} className={tab === 'games' ? 'active' : ''} onClick={showCatalog}><span><Gamepad2 size={21}/></span>{t("O'yinlar")}</button>
      <button className="nav-wallet" onClick={() => setShowWallet(true)}><span><WalletIcon size={22}/></span>{locale === 'ru' ? 'Баланс' : 'Balans'}</button>
      <button aria-current={tab === 'orders' ? 'page' : undefined} className={tab === 'orders' ? 'active' : ''} onClick={() => navigate('orders')}><span><Package size={21}/>{activeOrders.length > 0 && <i/>}</span>{t('Buyurtmalar')}</button>
      <button aria-current={tab === 'profile' ? 'page' : undefined} className={tab === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><span><UserRound size={21}/></span>{t('Profil')}</button>
    </nav>
    {game && (
      <Checkout
        key={`${game.id}:${quickProfile?.id || 'new'}`}
        game={game}
        savedProfile={quickProfile}
        authenticated={Boolean(user)}
        wallet={wallet}
        locale={locale}
        onClose={() => {
          setGame(null);
          setQuickProfile(null);
        }}
        onUpdated={refreshAccount}
        onTopUp={() => setShowWallet(true)}
        onOrders={async () => {
          await refreshAccount();
          setGame(null);
          setQuickProfile(null);
          navigate('orders');
        }}
      />
    )}
    {showWallet && (
      <WalletSheet
        wallet={wallet}
        locale={locale}
        onClose={() => setShowWallet(false)}
        onUpdated={refreshAccount}
        onNavigate={(next) => {
          setShowWallet(false);
          navigate(next);
        }}
      />
    )}
    {showLogin && (
      <LoginSheet
        locale={locale}
        onClose={() => setShowLogin(false)}
        onLogin={(session) => {
          setUser(session.user);
          setShowLogin(false);
          void refreshAccount();
        }}
      />
    )}
    {showNotifications && <Sheet title={t('Bildirishnomalar')} onClose={() => setShowNotifications(false)} className="notifications-sheet"><div className="notification-toolbar">{unreadNotifications > 0 && <button className="button secondary" onClick={markAllNotificationsRead}><CheckCircle2 size={17}/>{t("Hammasini o'qildi qilish")}</button>}</div>{notifications.length === 0 ? <div className="notification-empty"><Bell size={25}/><p>{t("Hozircha bildirishnomalar yo'q")}</p></div> : <div className="notification-list">{notifications.map((item) => <button key={item.id} className={`notification-row ${item.readAt ? '' : 'unread'}`} onClick={async () => { await markNotificationRead(item); openNotification(item); }}><span className="notification-symbol"><Bell size={17}/></span><span className="notification-copy"><strong>{notificationTitle(item.type, item.title, locale)}</strong><span>{notificationBody(item.type, item.body, locale)}</span><small>{date(item.createdAt, locale)}</small></span>{!item.readAt && <i aria-label={t('Yangi')}/>}</button>)}</div>}</Sheet>}
    {order && <OrderSheet order={orders.find((item) => item.id === order.id) || order} onClose={() => setOrder(null)} onUpdated={refreshAccount} supportUrl={config.supportUrl} locale={locale}/>}
  </div>{showIntro && <div className="launch-screen" aria-hidden="true"><div className="launch-mark"><img src="assets-store/brand.png" alt=""/><i/></div><strong>UZDONATE<span>.</span></strong><small>PLAY. TOP UP. WIN.</small></div>}</>;
}

function notificationTitle(type: string, fallback: string, locale: Locale) {
  const uz: Record<string, string> = { ORDER_SUCCESS: 'Buyurtma bajarildi', ORDER_FAILED: 'Buyurtmani bajarib bo‘lmadi', PAYMENT_SUCCESS: 'To‘lov qabul qilindi', TOPUP_SUCCESS: 'Balans to‘ldirildi', REFUND: 'Mablag‘ qaytarildi', SECURITY: 'Xavfsizlik xabari', PROMOTION: 'Yangilik' };
  const ru: Record<string, string> = { ORDER_SUCCESS: 'Заказ выполнен', ORDER_FAILED: 'Не удалось выполнить заказ', PAYMENT_SUCCESS: 'Платёж принят', TOPUP_SUCCESS: 'Баланс пополнен', REFUND: 'Средства возвращены', SECURITY: 'Уведомление безопасности', PROMOTION: 'Новости' };
  return (locale === 'ru' ? ru : uz)[type] || fallback;
}
function notificationBody(type: string, fallback: string, locale: Locale) {
  if (type === 'ORDER_SUCCESS') return locale === 'ru' ? 'Покупка успешно доставлена в игровой аккаунт.' : 'Xarid o‘yin hisobingizga muvaffaqiyatli yetkazildi.';
  if (type === 'ORDER_FAILED') return locale === 'ru' ? 'Откройте заказ и свяжитесь с поддержкой.' : 'Buyurtmani ochib, yordam xizmatiga murojaat qiling.';
  if (type === 'TOPUP_SUCCESS') return locale === 'ru' ? 'Средства уже доступны на вашем балансе.' : 'Mablag‘ balansingizda foydalanishga tayyor.';
  if (type === 'REFUND') return locale === 'ru' ? 'Проверьте историю операций в профиле.' : 'Amaliyotlar tarixini profilingizdan tekshiring.';
  return fallback;
}

function LoginSheet({ onClose, onLogin, locale }: { onClose: () => void; onLogin: (session: Session) => void; locale: Locale }) {
  const t = (text: string) => tr(locale, text);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { onLogin(await login(email.trim(), password)); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return <Sheet title={t('Hisobga kirish')} onClose={onClose} busy={busy}><form className="checkout-form" onSubmit={submit}><label>{t('Email')}<input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)}/></label><label>{t('Parol')}<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}/></label>{error && <ErrorBox message={t(error)}/>}<button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <ArrowRight size={18}/>} {t('Kirish')}</button></form></Sheet>;
}

function OrderSheet({ order, onClose, onUpdated, supportUrl, locale }: { order: Order; onClose: () => void; onUpdated: () => void; supportUrl: string; locale: Locale }) {
  const t = (text: string) => tr(locale, text);
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
  const statusText = locale === 'ru' ? ({ PENDING: 'Ожидает оплаты', PAID: 'Оплачен', PROCESSING: 'В обработке', COMPLETED: 'Выполнен', FAILED: 'Ошибка', CANCELLED: 'Отменён', REFUNDED: 'Возвращён' } as Record<string, string>)[order.status] : statuses[order.status];
  return <Sheet title={`${t('Buyurtmalar')} #${order.orderNumber}`} onClose={onClose} busy={busy}><div className="checkout-form"><span className={`status status-${order.status.toLowerCase()}`}>{statusText}</span><h3>{order.game.name}</h3><dl className="receipt"><div><dt>{t('Paket')}</dt><dd>{order.items[0]?.productName}</dd></div><div><dt>Player ID</dt><dd>{order.playerId}</dd></div>{order.zoneId && <div><dt>{t('Zone ID')}</dt><dd>{order.zoneId}</dd></div>}<div><dt>{t('Sana')}</dt><dd>{date(order.createdAt, locale)}</dd></div><div className="receipt-total"><dt>{t('Jami')}</dt><dd>{money(order.amountMinor, order.currency, locale)}</dd></div></dl>{order.failureReason && <p className="notice">{t("Buyurtma bajarilmadi. Yordam xizmati bilan bog'laning.")}</p>}{error && <ErrorBox message={error} locale={locale}/>} {order.status === 'PENDING' && <button className="button primary" disabled={busy} onClick={resume}>{busy ? <LoaderCircle size={18} className="spin"/> : <ArrowRight size={18}/>} {t("To'lovni davom ettirish")}</button>}<button className="button secondary" onClick={() => openTelegram(supportUrl)}><Headphones size={18}/> {t("Buyurtma bo'yicha yordam")}</button></div></Sheet>;
}
