import { useState } from 'react';
import { AlertCircle, ArrowUpRight, Gamepad2, RefreshCw } from 'lucide-react';
import type { Game, Order } from '../types';

export const money = (minor: number, currency = 'UZS') => `${(minor / 100).toLocaleString('uz-UZ', { maximumFractionDigits: 2 })} ${currency === 'UZS' ? "so'm" : 'Stars'}`;
export const date = (iso: string) => new Date(iso).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const statuses: Record<Order['status'], string> = { PENDING: "To'lov kutilmoqda", PAID: "To'langan", PROCESSING: 'Bajarilmoqda', COMPLETED: 'Bajarildi', FAILED: 'Bajarilmadi', CANCELLED: 'Bekor qilindi', REFUNDED: 'Qaytarildi' };
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-box" role="alert"><AlertCircle size={20}/><span>{message}</span>{retry && <button className="icon-button" title="Qayta urinish" aria-label="Qayta urinish" onClick={retry}><RefreshCw size={18}/></button>}</div>;
}
export function GameImage({ game, className = '' }: { game: Game; className?: string }) {
  const [failed, setFailed] = useState(false);
  return game.logoUrl && !failed ? <img className={className} src={game.logoUrl} alt={game.name} loading="lazy" onError={() => setFailed(true)}/>
    : <div className={`image-fallback ${className}`}><Gamepad2 size={40}/><span>{game.name}</span></div>;
}
export function GameCard({ game, onSelect }: { game: Game; onSelect: (game: Game) => void }) {
  return <button className="game-card" onClick={() => onSelect(game)}>
    <div className="game-cover"><GameImage game={game}/><span className={`availability ${game.isPurchasable ? '' : 'soon'}`}>{game.isPurchasable ? 'Mavjud' : 'Tez kunda'}</span></div>
    <div className="game-card-caption"><div><h3>{game.name}</h3><span>{game.category || "O'yin"}</span></div><ArrowUpRight size={19}/></div>
  </button>;
}
