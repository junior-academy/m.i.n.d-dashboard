export type CSVRow = Record<string, string>;

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCSV(text: string): CSVRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = splitCSVLine(lines[0]);
  const rows: CSVRow[] = [];
  for (const line of lines.slice(1)) {
    const parts = splitCSVLine(line);
    const row: CSVRow = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = parts[i] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

export function toNumber(v: string): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : Number.NaN;
}

