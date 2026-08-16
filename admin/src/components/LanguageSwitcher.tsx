import { useLocale } from '../i18n/LocaleContext';
import { LOCALES, type Locale } from '../i18n/translations';

const LABELS: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className={`lang-switch ${className}`.trim()} role="group" aria-label="Language">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-switch-btn${locale === code ? ' active' : ''}`}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
