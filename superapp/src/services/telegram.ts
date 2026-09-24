interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { language_code?: string } };
  ready(): void; expand(): void;
  setHeaderColor(color: string): void; setBackgroundColor(color: string): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  HapticFeedback?: { impactOccurred(style: 'light' | 'medium'): void; notificationOccurred(type: 'success' | 'error'): void };
  BackButton: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void };
}
declare global { interface Window { Telegram?: { WebApp: TelegramWebApp } } }
export const telegram = () => window.Telegram?.WebApp;
export const inTelegram = () => Boolean(telegram()?.initData);
export function haptic() { telegram()?.HapticFeedback?.impactOccurred('light'); }
export function openTelegram(url: string) {
  if (!/^https:\/\/t\.me\//.test(url)) return;
  if (inTelegram()) telegram()?.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
