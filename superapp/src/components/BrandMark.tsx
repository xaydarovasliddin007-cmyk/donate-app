/** Shared UD mark; the same asset is used by the app and Telegram bot. */
export function BrandMark({ className = '' }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true">
    <img src="assets-store/brand.svg" alt="" width="40" height="40" onError={(event) => {
      if (!event.currentTarget.src.endsWith('/brand.png')) event.currentTarget.src = 'assets-store/brand.png';
    }}/>
  </span>;
}
