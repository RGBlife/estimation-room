import type { PlanningTicket } from '../../types/planning.ts';

export interface TicketFilters { search: string; team: string; status: string }
export interface TicketProvider {
  // A real provider can translate these choices into Jira queries later.
  list: (filters: TicketFilters) => Promise<PlanningTicket[]>;
}
const tickets: PlanningTicket[] = [
  { key: 'WEB-142', title: 'Keep filters when returning to search results', team: 'Web experience', status: 'Backlog', source: 'demo', description: 'People lose their search context after opening a result. Keep the selected filters and scroll position when they return.\n\nAcceptance criteria\n• Back navigation restores the search and filters.\n• Sharing the URL preserves filter choices.\n• A new search starts at the top of the list.' },
  { key: 'WEB-148', title: 'Make keyboard navigation work in the account menu', team: 'Web experience', status: 'Ready', source: 'demo', description: 'Support opening, navigating and closing the account menu without a mouse.\n\nAcceptance criteria\n• Arrow keys move between menu items.\n• Escape closes the menu and restores focus.\n• Screen readers announce the selected item.' },
  { key: 'APP-83', title: 'Save a draft when a connection drops', team: 'Mobile', status: 'Backlog', source: 'demo', description: 'Protect work in progress when the device goes offline. Restore the latest local draft on return and make its sync status clear.\n\nOpen question\nHow should conflicting edits on two devices be resolved?' },
  { key: 'APP-91', title: 'Show upload progress for attachments', team: 'Mobile', status: 'Ready', source: 'demo', description: 'Show individual progress and retry actions for attachments. Failed uploads should leave the rest of the draft intact.' },
  { key: 'API-206', title: 'Add a bulk export for workspace members', team: 'Core services', status: 'Backlog', source: 'demo', description: 'Workspace admins need a CSV export of their member list. Include names, roles and invitation status.\n\nAcceptance criteria\n• Only admins can request an export.\n• Large exports run asynchronously.\n• Export links expire after 24 hours.' },
  { key: 'API-211', title: 'Retry delayed notification deliveries', team: 'Core services', status: 'In progress', source: 'demo', description: 'Retry temporary delivery failures with a bounded delay. Expose a delivery status that support can inspect without seeing message content.' },
];
export const DEMO_TEAMS = [...new Set(tickets.map(t => t.team))];
export const demoTicketProvider: TicketProvider = {
  list: async ({ search, team, status }) => tickets.filter(t => (!team || t.team === team) && (!status || t.status === status)
    && `${t.key} ${t.title} ${t.description}`.toLowerCase().includes(search.trim().toLowerCase())),
};
