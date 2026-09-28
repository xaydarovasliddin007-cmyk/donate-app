import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { Game } from '../types';
import { tr, type Locale } from '../i18n';
import './GameBanner.css';

const order = ['mobile-legends', 'pubg-mobile', 'free-fire'];
const descriptions: Record<string, string> = {
  'mobile-legends': 'Olmoslarni tez va xavfsiz xarid qiling.',
  'pubg-mobile': 'UC paketlari eng qulay narxlarda.',
  'free-fire': 'Diamond paketlari bir necha bosishda.',
};

export function GameBanner({ games, locale, active = true, onSelect }: {
  games: Game[]; locale: Locale; active?: boolean; onSelect: (game: Game) => void;
}) {
  const slides = useMemo(() => {
    const featured = order.map((slug) => games.find((game) => game.slug === slug))
      .filter((game): game is Game => Boolean(game));
    const fallback = games.find((game) => game.isPurchasable);
    return featured.length ? featured : fallback ? [fallback] : [];
  }, [games]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [canRotate, setCanRotate] = useState(false);
  const index = Math.max(0, slides.findIndex((game) => game.id === selectedId));
  const game = slides[index];
  const t = (text: string) => tr(locale, text);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setCanRotate(!document.hidden && !motion.matches);
    update();
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!active || !canRotate || hovered || focused || slides.length < 2) return;
    const timer = window.setTimeout(() => setSelectedId(slides[(index + 1) % slides.length].id), 4500);
    return () => window.clearTimeout(timer);
  }, [active, canRotate, hovered, focused, index, slides]);

  if (!game) return null;
  const title = game.slug === 'mobile-legends' ? 'Mobile Legends' : game.name;

  return <section className="game-banner" aria-label={t("Mashhur o'yinlar")}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {/* One keyed slide replaces both its text and artwork together. */}
    <button type="button" key={`slide:${game.id}`} className="game-banner__slide" data-game-id={game.id}
      aria-label={`${t('Xaridni boshlash')}: ${game.name}`} onClick={() => onSelect(game)}>
      {game.logoUrl && <img className="game-banner__art" src={game.logoUrl} alt="" decoding="async"
        onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}/>
      }
      <span className="game-banner__copy">
        <span className="game-banner__eyebrow"><Sparkles size={13}/>{t('TEZKOR TOP-UP')}</span>
        <strong className="game-banner__title">{title}</strong>
        <span className="game-banner__description">{t(descriptions[game.slug] || 'Eng yaxshi narxlar va tezkor yetkazib berish.')}</span>
        <span className="game-banner__cta">{t('Xaridni boshlash')}<ArrowRight size={17}/></span>
      </span>
    </button>
    {slides.length > 1 && <div className="game-banner__controls">
      <div className="game-banner__dots">{slides.map((item) => <button type="button" key={`dot:${item.id}`}
        title={item.name} aria-label={item.name} aria-pressed={item.id === game.id}
        onClick={() => setSelectedId(item.id)}><span/></button>)}</div>
      <span className="game-banner__count" aria-hidden="true">{String(index + 1).padStart(2, '0')}<span> / {String(slides.length).padStart(2, '0')}</span></span>
    </div>}
  </section>;
}
