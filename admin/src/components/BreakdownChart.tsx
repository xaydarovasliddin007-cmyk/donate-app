export interface BreakdownRow {
  label: string;
  value: number;
  displayValue?: string;
}

/**
 * A minimal horizontal bar list — deliberately not a charting library.
 * Enough to show relative proportions at a glance without adding a
 * dependency or hurting load time.
 */
export function BreakdownChart({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="panel">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">No data</p>
      ) : (
        <div className="bar-list">
          {rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <div className="bar-row-label">
                <span>{row.label}</span>
                <span>{row.displayValue ?? row.value}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
