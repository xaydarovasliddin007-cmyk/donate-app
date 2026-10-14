/** Shared UZDONATE monogram; the parent wordmark provides its accessible name. */
export function BrandMark({ className = '' }: { className?: string }) {
  return <img
    className={`brand-symbol ${className}`}
    src={`${import.meta.env.BASE_URL}brand.svg`}
    width={48}
    height={48}
    alt=""
    aria-hidden="true"
  />;
}
