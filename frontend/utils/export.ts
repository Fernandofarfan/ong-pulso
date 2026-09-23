function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
) {
  if (rows.length === 0) {
    downloadBlob(filename, "text/csv;charset=utf-8", "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(",")),
  ];
  downloadBlob(filename, "text/csv;charset=utf-8", lines.join("\n"));
}

export function exportJson(
  filename: string,
  payload: unknown,
) {
  downloadBlob(filename, "application/json", JSON.stringify(payload, null, 2));
}
