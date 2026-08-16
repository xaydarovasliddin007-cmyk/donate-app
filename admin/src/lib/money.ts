type MoneyLocale = 'uz' | 'ru' | 'en';

const NUMBER_LOCALE: Record<MoneyLocale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
const DATE_LOCALE: Record<MoneyLocale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

let activeLocale: MoneyLocale = 'uz';

/** Set once by LocaleProvider whenever the admin switches language, so every formatMinor/formatDate call site stays locale-aware without threading a locale prop through every page. */
export function setMoneyLocale(locale: MoneyLocale) {
  activeLocale = locale;
}

export function formatMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${major.toLocaleString(NUMBER_LOCALE[activeLocale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(DATE_LOCALE[activeLocale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
