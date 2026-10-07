import { expect, it } from 'vitest';
import { maskContacts, parseDelimited, parseTickets, plainFromJira, readTicketFile } from './ticketImport.ts';

const jiraCsv = [
  'Summary,Issue key,Issue id,Issue Type,Status,Assignee,Reporter,Watchers,Watchers,Description,Comment',
  '"Keep filters, please",WEB-142,10001,Story,Backlog,Ada Lovelace,Bo Ng,Cy,Di,"h2. Context\nAsk [~accountid:5f1a] or mail ada@example.com\n* Back restores filters\n* Call +44 7700 900123",Looks good - Bo',
  'Make keyboard navigation work,WEB-148,10002,Story,Ready,,,,,"{code}menu.open(){code}",',
].join('\r\n');

it('keeps only key, summary and description from a Jira CSV export', () => {
  const result = parseTickets(jiraCsv);
  expect(result.source).toBe('jira');
  expect(result.kept).toEqual(['Summary', 'Issue key', 'Description']);
  expect(result.dropped).toEqual(['Issue id', 'Issue Type', 'Status', 'Assignee', 'Reporter', 'Watchers', 'Comment']);
  expect(result.tickets).toHaveLength(2);
  const [first, second] = result.tickets;
  expect(first.draft).toEqual({
    key: 'WEB-142', title: 'Keep filters, please',
    description: 'Context\nAsk [person] or mail [email]\n• Back restores filters\n• Call [phone]',
  });
  expect(JSON.stringify(result.tickets)).not.toMatch(/Ada Lovelace|Bo Ng|Looks good/);
  expect(first.unmasked).toBe('Context\nAsk @5f1a or mail ada@example.com\n• Back restores filters\n• Call +44 7700 900123');
  expect(result.masked).toEqual({ emails: 1, phones: 1, mentions: 1 });
  expect(second.draft.description).toBe('menu.open()');
  expect(second.unmasked).toBeUndefined();
});

it('reads tab-separated spreadsheet copies and semicolon exports', () => {
  expect(parseTickets('Key\tTitle\nAPP-1\tSave drafts\nAPP-2\tShow progress').tickets.map(t => t.draft))
    .toEqual([{ key: 'APP-1', title: 'Save drafts' }, { key: 'APP-2', title: 'Show progress' }]);
  expect(parseTickets('Title;Details\nOne;First\nTwo;Second').tickets[1].draft).toEqual({ title: 'Two', description: 'Second' });
  expect(parseTickets('APP-1\tSave drafts\nAPP-2\tShow progress').tickets[0].draft).toEqual({ key: 'APP-1', title: 'Save drafts' });
});

it('reads lists, keyed lines and Jira links', () => {
  const result = parseTickets([
    '- [ ] Write the release notes',
    '2. WEB-9: Fix the footer',
    'https://acme.atlassian.net/browse/API-206',
    'https://acme.atlassian.net/jira/software/projects/API/boards/1?selectedIssue=API-211 Retry deliveries',
    'WEB-9 duplicate is skipped',
    '',
  ].join('\n'));
  expect(result.source).toBe('list');
  expect(result.tickets.map(t => t.draft)).toEqual([
    { title: 'Write the release notes' },
    { key: 'WEB-9', title: 'Fix the footer' },
    { key: 'API-206', title: 'API-206' },
    { key: 'API-211', title: 'Retry deliveries' },
  ]);
  expect(result.skipped).toBe(1);
});

it('parses quoted fields with commas, quotes and line breaks', () => {
  expect(parseDelimited('a,"b, ""c""\nd",e\n\n1,2,3')).toEqual([['a', 'b, "c"\nd', 'e'], ['1', '2', '3']]);
});

it('trims overlong text to the backlog limits', () => {
  const result = parseTickets(`Summary,Description\n${'t'.repeat(300)},${'d'.repeat(2500)}`);
  expect(result.tickets[0].draft.title).toHaveLength(200);
  expect(result.tickets[0].draft.description).toHaveLength(2000);
  expect(result.tickets[0].trimmed).toBe(true);
});

it('masks contact details but not dates, versions or ids', () => {
  const { text, masked } = maskContacts('Due 2026-10-02, v1.2.3.4, order 1234567890, call (555) 123-4567 or a.b@c.co.uk');
  expect(text).toBe('Due 2026-10-02, v1.2.3.4, order 1234567890, call [phone] or [email]');
  expect(masked).toEqual({ emails: 1, phones: 1, mentions: 0 });
});

it('reduces Jira markup to plain text', () => {
  expect(plainFromJira('h3. Steps\n# Open [the docs|https://x.test]\n!shot.png|thumbnail!\n{{code}}')).toBe('Steps\n• Open the docs (https://x.test)\n\ncode');
});

// jsdom's File has no text(); browsers all do.
File.prototype.text ??= function (this: File) {
  return new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsText(this); });
};

it('refuses spreadsheets and oversized files without reading them', async () => {
  await expect(readTicketFile(new File(['x'], 'a.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))).rejects.toThrow('CSV');
  const big = new File(['x'], 'big.csv', { type: 'text/csv' });
  Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
  await expect(readTicketFile(big)).rejects.toThrow('5 MB');
  expect((await readTicketFile(new File(['\uFEFFSummary\nOne'], 'a.csv', { type: 'text/csv' }))).tickets[0].draft.title).toBe('One');
});

it('keeps one ticket per line even with blank lines between them', () => {
  expect(parseTickets('WEB-142 Keep filters\n\nSecond ticket\nThird ticket').tickets.map(t => t.draft))
    .toEqual([{ key: 'WEB-142', title: 'Keep filters' }, { title: 'Second ticket' }, { title: 'Third ticket' }]);
});
