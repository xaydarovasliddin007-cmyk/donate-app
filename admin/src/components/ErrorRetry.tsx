import { useLocale } from '../i18n/LocaleContext';

/** Consistent inline error + retry action for list pages, instead of a dead-end error line. */
export function ErrorRetry({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="toolbar">
      <p className="form-error" style={{ margin: 0 }}>
        {error}
      </p>
      <button className="btn btn-secondary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}
