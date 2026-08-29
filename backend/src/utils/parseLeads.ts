// Parses an uploaded CSV or plain-text file of leads into a de-duplicated
// list of valid email addresses. Supports:
//   - a CSV with an "email" column (case-insensitive header match), or
//   - a CSV/text file with one email per line / per cell (no header),
// so we don't force the user into one exact format.

import Papa from "papaparse";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLeadsFile(fileBuffer: Buffer): string[] {
  const text = fileBuffer.toString("utf-8");
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });

  const rows = parsed.data;
  if (rows.length === 0) return [];

  const emails: string[] = [];

  // Detect an "email" header column.
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const emailColIndex = header.indexOf("email");

  const dataRows = emailColIndex !== -1 ? rows.slice(1) : rows;

  for (const row of dataRows) {
    if (emailColIndex !== -1) {
      const candidate = row[emailColIndex]?.trim();
      if (candidate && EMAIL_REGEX.test(candidate)) emails.push(candidate);
    } else {
      // No header — scan every cell in the row for anything email-shaped.
      for (const cell of row) {
        const candidate = cell?.trim();
        if (candidate && EMAIL_REGEX.test(candidate)) emails.push(candidate);
      }
    }
  }

  return Array.from(new Set(emails.map((e) => e.toLowerCase())));
}
