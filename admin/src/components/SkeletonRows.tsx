/** Placeholder rows shown only on a table's first load — reload/filter changes keep the existing rows visible instead of flashing this, since useAsync doesn't clear stale data while refetching. */
export function SkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: columns }, (_, j) => (
            <td key={j}>
              <span className="skeleton-bar" style={{ width: `${50 + ((i * 9 + j * 17) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
