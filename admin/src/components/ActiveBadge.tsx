import { useLocale } from '../i18n/LocaleContext';

/** Same badge treatment as StatusBadge, for the isActive boolean that
 * several admin-configured entities (receiving methods, game servers,
 * products, providers, admins) share — keeps the localized on/off label
 * StatusBadge alone can't give a raw boolean. */
export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useLocale();
  return (
    <span className={`badge ${active ? 'badge-success' : 'badge-neutral'}`}>
      {active ? t('common.active') : t('common.inactive')}
    </span>
  );
}
