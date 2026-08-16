import { useLocale } from '../i18n/LocaleContext';

export function Loading({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <div className="loading-state">
      <span className="spinner" aria-hidden="true" />
      {label ?? t('common.loading')}
    </div>
  );
}
