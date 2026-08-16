const TONES: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  PAID: 'neutral',
  FULFILLING: 'neutral',
  COMPLETED: 'success',
  SUCCEEDED: 'success',
  VERIFIED: 'success',
  FAILED: 'danger',
  REJECTED: 'danger',
  EXPIRED: 'danger',
  CANCELLED: 'danger',
  REFUNDED: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  HEALTHY: 'success',
  DEGRADED: 'warning',
  DOWN: 'danger',
  UNKNOWN: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? 'neutral';
  return <span className={`badge badge-${tone}`}>{status}</span>;
}
