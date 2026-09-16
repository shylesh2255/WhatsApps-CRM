export interface ParsedLeadRow {
  firstName: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  source?: string;
  industry?: string;
  notes?: string;
}

export interface ParseLeadCsvResult {
  rows: ParsedLeadRow[];
  hasFirstNameColumn: boolean;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

const clean = (value: string | undefined) => value?.replace(/["']/g, '').trim() || undefined;

export function parseLeadCsv(text: string): ParseLeadCsvResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], hasFirstNameColumn: false };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
  const idx = (name: string) => headers.indexOf(name);

  const firstNameIdx = idx('first_name') >= 0 ? idx('first_name') : idx('firstname');
  if (firstNameIdx === -1) return { rows: [], hasFirstNameColumn: false };

  const lastNameIdx = idx('last_name') >= 0 ? idx('last_name') : idx('lastname');
  const companyIdx = idx('company') >= 0 ? idx('company') : idx('company_name');
  const emailIdx = idx('email');
  const phoneIdx = idx('phone');
  const altPhoneIdx = idx('alternate_phone');
  const sourceIdx = idx('source');
  const industryIdx = idx('industry');
  const notesIdx = idx('notes');

  const rows: ParsedLeadRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const firstName = clean(values[firstNameIdx]);
    if (!firstName) continue;
    rows.push({
      firstName,
      lastName: clean(values[lastNameIdx]),
      companyName: companyIdx >= 0 ? clean(values[companyIdx]) : undefined,
      email: emailIdx >= 0 ? clean(values[emailIdx]) : undefined,
      phone: phoneIdx >= 0 ? clean(values[phoneIdx]) : undefined,
      alternatePhone: altPhoneIdx >= 0 ? clean(values[altPhoneIdx]) : undefined,
      source: sourceIdx >= 0 ? clean(values[sourceIdx]) : undefined,
      industry: industryIdx >= 0 ? clean(values[industryIdx]) : undefined,
      notes: notesIdx >= 0 ? clean(values[notesIdx]) : undefined,
    });
  }

  return { rows, hasFirstNameColumn: true };
}

export function leadsToCsv(
  leads: Array<{
    first_name: string;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    source: string;
    industry: string | null;
    status: string;
    priority: string;
    expected_value: number | null;
    notes: string | null;
  }>
): string {
  const headers = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'source', 'industry', 'status', 'priority', 'expected_value', 'notes'];
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const lead of leads) {
    lines.push(
      headers.map((h) => escape((lead as unknown as Record<string, unknown>)[h])).join(',')
    );
  }
  return lines.join('\n');
}
