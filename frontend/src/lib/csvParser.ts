import type { LeadParseResult } from '../types/email';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Parses raw text or CSV content into unique valid email addresses
export function parseLeads(rawText: string): LeadParseResult {
  if (!rawText || typeof rawText !== 'string') {
    return { validEmails: [], invalidCount: 0, totalParsed: 0 };
  }

  const lines = rawText.split(/\r?\n/);
  const validEmailSet = new Set<string>();
  let invalidCount = 0;
  let totalProcessed = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue; // Skip completely empty lines

    const cells = rawLine.split(/[,;\t]/).map((c) => c.replace(/["']/g, '').trim());

    // Skip common CSV header rows
    if (
      i === 0 &&
      cells.some((cell) => ['email', 'email address', 'emails', 'recipient', 'contact'].includes(cell.toLowerCase()))
    ) {
      continue;
    }

    totalProcessed++;

    let foundEmail = false;
    for (const cell of cells) {
      if (EMAIL_REGEX.test(cell)) {
        validEmailSet.add(cell.toLowerCase());
        foundEmail = true;
        break;
      }
    }

    if (!foundEmail) {
      invalidCount++;
    }
  }

  return {
    validEmails: Array.from(validEmailSet),
    invalidCount,
    totalParsed: totalProcessed,
  };
}

// Parses matrix of rows/cells (e.g. from Excel spreadsheets) into unique valid email addresses
export function parseRows(rows: any[][]): LeadParseResult {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { validEmails: [], invalidCount: 0, totalParsed: 0 };
  }

  const validEmailSet = new Set<string>();
  let invalidCount = 0;
  let totalProcessed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const cells = row
      .filter((cell) => cell !== null && cell !== undefined)
      .map((cell) => String(cell).trim())
      .filter((cell) => cell.length > 0);

    if (cells.length === 0) continue;

    // Skip common header row if present
    if (
      i === 0 &&
      cells.some((cell) =>
        ['email', 'email address', 'emails', 'recipient', 'contact', 'leads', 'name'].includes(cell.toLowerCase())
      ) &&
      !cells.some((cell) => EMAIL_REGEX.test(cell))
    ) {
      continue;
    }

    totalProcessed++;

    let foundEmail = false;
    for (const cell of cells) {
      if (EMAIL_REGEX.test(cell)) {
        validEmailSet.add(cell.toLowerCase());
        foundEmail = true;
        break;
      }
    }

    if (!foundEmail) {
      invalidCount++;
    }
  }

  return {
    validEmails: Array.from(validEmailSet),
    invalidCount,
    totalParsed: totalProcessed,
  };
}

