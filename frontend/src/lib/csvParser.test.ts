import { describe, it, expect } from 'vitest';
import { parseLeads } from './csvParser';

describe('CSV & Text Lead Parser', () => {
  it('parses clean line-separated email addresses', () => {
    const raw = `
      alice@example.com
      bob@reachinbox.ai
      carol@domain.co
    `;

    const result = parseLeads(raw);
    expect(result.validEmails).toEqual([
      'alice@example.com',
      'bob@reachinbox.ai',
      'carol@domain.co',
    ]);
    expect(result.invalidCount).toBe(0);
  });

  it('skips CSV headers and parses multi-column CSVs correctly', () => {
    const raw = `email,name,role
alice@example.com,Alice Smith,Engineer
bob@example.com,Bob Jones,Manager`;

    const result = parseLeads(raw);
    expect(result.validEmails).toEqual(['alice@example.com', 'bob@example.com']);
    expect(result.invalidCount).toBe(0);
  });

  it('correctly tracks invalid rows and ignores empty lines', () => {
    const raw = `
      alice@example.com
      not-an-email
      another_bad_row@@missing-dot
      
      charlie@reachinbox.ai
    `;

    const result = parseLeads(raw);
    expect(result.validEmails).toEqual(['alice@example.com', 'charlie@reachinbox.ai']);
    expect(result.invalidCount).toBe(2);
  });

  it('deduplicates duplicate email addresses and normalizes case', () => {
    const raw = `
      ALICE@EXAMPLE.COM
      alice@example.com
      Alice@Example.Com
      bob@example.com
    `;

    const result = parseLeads(raw);
    expect(result.validEmails).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('gracefully handles empty strings or empty files without throwing', () => {
    const result = parseLeads('');
    expect(result.validEmails).toEqual([]);
    expect(result.invalidCount).toBe(0);
    expect(result.totalParsed).toBe(0);
  });
});
