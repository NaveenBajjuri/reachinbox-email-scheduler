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

    totalProcessed++;

    // Check if line is a CSV row with multiple columns (e.g., email,name,company)
    // Extract first cell or scan columns for an email address
    const cells = rawLine.split(/[,;\t]/).map((c) => c.replace(/["']/g, '').trim());

    // Skip common CSV header rows
    if (
      i === 0 &&
      cells.some((cell) => ['email', 'email address', 'emails', 'recipient', 'contact'].includes(cell.toLowerCase()))
    ) {
      continue;
    }

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
