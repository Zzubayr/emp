export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => {
      const s = v == null ? "" : String(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // stop spreadsheet formula injection
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    }).join(","))
    .join("\n");
}
