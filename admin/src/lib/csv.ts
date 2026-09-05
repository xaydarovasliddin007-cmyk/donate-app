/** Escapes a value for a CSV cell — wraps in quotes and doubles any embedded quote whenever the value contains a comma, quote, or newline. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV string from an array of same-shaped row objects, using the first row's keys as the header. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(','));
  }
  // Leading BOM so Excel opens UTF-8 (Cyrillic/Uzbek text) correctly instead of mangling it.
  return '﻿' + lines.join('\r\n');
}

/** Triggers a browser download of the given rows as a CSV file. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
