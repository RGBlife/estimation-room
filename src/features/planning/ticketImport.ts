import type { TicketDraft } from '../../types/planning.ts';
import { LIMITS } from './backlog.ts';

// Turns whatever someone pastes or drops into ticket drafts, entirely in the
// browser. Only key, title and description are kept; every other
// column (assignee, reporter, watchers, comments...) is read past and never
// leaves the device. Contact details in descriptions are masked by default.

export type ImportSource = 'jira' | 'table' | 'list';
export interface ImportedTicket {
  draft: TicketDraft;
  // The description before masking, for "keep originals". Undefined when
  // masking changed nothing.
  unmasked?: string;
  trimmed: boolean;
}
export interface ImportResult {
  source: ImportSource;
  tickets: ImportedTicket[];
  kept: string[];
  // Header names of the columns that were read past, first spelling only.
  dropped: string[];
  masked: { emails: number; phones: number; mentions: number };
  skipped: number;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const KEY = /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/;
const KEY_PREFIX = /^([A-Z][A-Z0-9_]{0,19}-\d{1,9})(?![\w-])[\s:|.–—-]*(.*)$/;
const ISSUE_URL = /https?:\/\/\S+?(?:\/browse\/|[?&]selectedIssue=|\/issues\/)([A-Z][A-Z0-9_]{0,19}-\d{1,9})\S*/;
const BULLET = /^\s*(?:[-*•+]\s+(?:\[[ xX]\]\s+)?|\[[ xX]\]\s+|\d{1,3}[.)]\s+)/;

const HEADERS: Record<'key' | 'title' | 'description', string[]> = {
  key: ['issue key', 'key', 'ticket', 'ticket key', 'issue'],
  title: ['summary', 'title', 'name', 'story', 'ticket title'],
  description: ['description', 'details', 'body', 'notes'],
};

// RFC 4180, plus whichever of tab, comma or semicolon the first line uses most
// outside quotes (spreadsheet copies are tab separated, some locales export
// with semicolons). Quoted fields may span lines, as Jira descriptions do.
export function parseDelimited(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim()));
}

function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { '\t': 0, ',': 0, ';': 0 };
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '\n' || c === '\r')) break;
    else if (!quoted && c in counts) counts[c]++;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : '\t';
}

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/^custom field \((.*)\)$/, '$1').replace(/\s+/g, ' ');

// Jira's wiki markup, reduced to readable plain text.
export function plainFromJira(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\{\{([^}]*)\}\}/g, '$1')
    .replace(/\{(?:code|noformat|quote|panel|color|expand)(?::[^}]*)?\}/g, '')
    .replace(/!(?:[^!\n|]+)(?:\|[^!\n]*)?!/g, '')
    .replace(/\[([^|\]\n]+)\|([^\]\n]+)\]/g, (_, label: string, href: string) => href.startsWith('~') ? `[${href}]` : `${label} (${href})`)
    .replace(/^h[1-6]\.\s*/gm, '')
    .replace(/^[*#-]+\s+/gm, '• ')
    .replace(/^bq\.\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const PHONE = /(?<![\w+])\+?\(?\d[\d\s().-]{7,}\d(?!\w)/g;
const MENTION = /\[~[^\]\n]{1,128}\]/g;

export function maskContacts(text: string) {
  const masked = { emails: 0, phones: 0, mentions: 0 };
  const result = text
    .replace(MENTION, () => { masked.mentions++; return '[person]'; })
    .replace(EMAIL, () => { masked.emails++; return '[email]'; })
    .replace(PHONE, match => {
      const digits = match.replace(/\D/g, '').length;
      // A phone number has 9-15 digits and either a leading + or separators
      // between groups; dates, versions and bare ids are left alone.
      if (digits < 9 || digits > 15 || /^\d{4}-\d{2}-\d{2}/.test(match) || /^\d+(?:\.\d+)+$/.test(match)) return match;
      if (!match.startsWith('+') && !/\d[\s().-]+\d/.test(match)) return match;
      masked.phones++; return '[phone]';
    });
  return { text: result, masked };
}

const oneLine = (value: string, max: number) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

function finish(source: ImportSource, rows: Array<{ key?: string; title: string; description?: string }>, kept: string[], dropped: string[], skipped: number): ImportResult {
  const total = { emails: 0, phones: 0, mentions: 0 };
  const seen = new Set<string>();
  const tickets: ImportedTicket[] = [];
  for (const row of rows) {
    const key = row.key && row.key.trim().length <= LIMITS.key ? row.key.replace(/\s+/g, ' ').trim() : undefined;
    const title = oneLine(row.title || key || '', LIMITS.title);
    if (!title) { skipped++; continue; }
    if (key && seen.has(key)) { skipped++; continue; }
    if (key) seen.add(key);
    let description: string | undefined;
    let unmasked: string | undefined;
    let trimmed = false;
    if (row.description?.trim()) {
      const plain = source === 'jira' ? plainFromJira(row.description) : row.description.replace(/\r\n?/g, '\n').trim();
      const { text, masked } = maskContacts(plain);
      total.emails += masked.emails; total.phones += masked.phones; total.mentions += masked.mentions;
      const fit = (value: string) => {
        if (value.length <= LIMITS.description) return value;
        trimmed = true;
        return `${value.slice(0, LIMITS.description - 1).trimEnd()}…`;
      };
      description = fit(text);
      if (text !== plain) unmasked = fit(plain.replace(MENTION, m => `@${m.slice(2, -1).replace(/^accountid:/, '')}`));
    }
    tickets.push({ draft: { title, ...(key ? { key } : {}), ...(description ? { description } : {}) }, unmasked, trimmed });
  }
  return { source, tickets, kept, dropped, masked: total, skipped };
}

function fromTable(rows: string[][]): ImportResult | null {
  const header = rows[0].map(normalizeHeader);
  const column = (names: string[]) => header.findIndex(h => names.includes(h));
  const at = { key: column(HEADERS.key), title: column(HEADERS.title), description: column(HEADERS.description) };
  if (at.title !== -1) {
    const used = new Set(Object.values(at).filter(i => i !== -1));
    const kept = [...used].sort((a, b) => a - b).map(i => rows[0][i].trim());
    const dropped = [...new Set(rows[0].filter((_, i) => !used.has(i)).map(h => h.trim()).filter(Boolean))];
    const isJira = header.includes('issue key') || header.includes('issue id') || header.includes('issue type');
    const cell = (row: string[], i: number) => (i === -1 ? undefined : row[i]);
    return finish(isJira ? 'jira' : 'table', rows.slice(1).map(row => ({
      key: cell(row, at.key), title: cell(row, at.title) ?? '', description: cell(row, at.description),
    })), kept, dropped, 0);
  }
  // No header: a key in the first column of most rows means key, then title.
  const keyed = rows.filter(r => KEY.test(r[0]?.trim() ?? '')).length;
  if (rows[0].length >= 2 && keyed >= Math.ceil(rows.length / 2)) {
    return finish('table', rows.map(r => KEY.test(r[0].trim())
      ? { key: r[0].trim(), title: r[1] ?? '', description: r[2] }
      : { title: r.join(' ') }), [], [], 0);
  }
  return null;
}

function fromLine(text: string) {
  const line = text.replace(BULLET, '').trim();
  const url = line.match(ISSUE_URL);
  if (url) {
    const rest = line.replace(url[0], '').replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, '');
    return { key: url[1], title: rest || url[1] };
  }
  const keyed = line.match(KEY_PREFIX);
  return keyed ? { key: keyed[1], title: keyed[2] || keyed[1] } : { title: line };
}

// One ticket per line. Descriptions come from a CSV, or are added to the
// ticket afterwards.
function fromLines(text: string): ImportResult {
  return finish('list', text.split(/\r\n?|\n/).filter(line => line.trim()).map(fromLine), [], [], 0);
}

export function parseTickets(text: string): ImportResult {
  const input = text.replace(/^\uFEFF/, '');
  if (!input.trim()) return { source: 'list', tickets: [], kept: [], dropped: [], masked: { emails: 0, phones: 0, mentions: 0 }, skipped: 0 };
  const firstLine = input.slice(0, input.search(/\r|\n|$/));
  if (/[\t,;]/.test(firstLine)) {
    const rows = parseDelimited(input);
    if (rows.length && rows[0].length > 1) {
      const table = fromTable(rows);
      if (table) return table;
    }
  }
  // A one-column export still has its header row.
  return fromLines(HEADERS.title.includes(normalizeHeader(firstLine)) ? input.slice(firstLine.length) : input);
}

export async function readTicketFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is over 5 MB. Export fewer issues or only the current fields.');
  if (file.type && !/^(text\/|application\/(vnd\.ms-excel|csv))/.test(file.type)) throw new Error('Choose a CSV or text file. Excel files need saving as CSV first.');
  return parseTickets(await file.text());
}
