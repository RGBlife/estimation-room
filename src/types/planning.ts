export interface ReadinessItem { text: string; checked: boolean }
export type Readiness = Record<string, ReadinessItem>;
export type ReadinessChange =
  | { operation: 'add'; id: string; text: string }
  | { operation: 'edit'; id: string; text: string }
  | { operation: 'toggle'; id: string; checked: boolean }
  | { operation: 'remove'; id: string }
  | { operation: 'replace'; items: Readiness };

// Who did something to a ticket, as they were named at the time. The uid ties
// it to a seat while they are still in the room; the name outlives the seat.
export interface Author { uid: string; name: string; at: number }

export type EditableField = 'key' | 'title' | 'description';

// A passage of the description someone marked for the table. Offsets are
// UTF-16 indices into the description, end exclusive, never overlapping.
export interface TicketHighlight { id: string; start: number; end: number; by: Author }

// One entry in the room's shared backlog. Plain text only: imports keep just
// these fields and leave every other column, including people, on the device.
export interface BacklogTicket {
  id: string;
  key?: string;
  title: string;
  description?: string;
  status?: string;
  position: number;
  added: Author;
  // The last person to change each field, so edits are attributed by field.
  edited?: Partial<Record<EditableField, Author>>;
  highlights?: TicketHighlight[];
  // Set when a round is revealed with this ticket at the table: the most
  // common vote, or the tied values joined with " / ".
  estimate?: { value: string; at: number };
}

export interface TicketDraft { key?: string; title: string; description?: string; status?: string }

export type BacklogChange =
  | { operation: 'add'; tickets: Array<TicketDraft & { id: string }> }
  | { operation: 'edit'; id: string; field: EditableField; value: string }
  | { operation: 'remove'; id: string }
  | { operation: 'highlight'; id: string; highlightId: string; start: number; end: number }
  | { operation: 'unhighlight'; id: string; highlightId: string }
  | { operation: 'clear' };

// Legacy: the snapshot rooms carried before the shared backlog. Still read so
// a room selected by an older build shows its ticket; new selections refer to
// a backlog entry by id instead, keeping descriptions out of the room record.
export interface PlanningTicket {
  key: string;
  title: string;
  description: string;
  team: string;
  status: 'Backlog' | 'Ready' | 'In progress';
  source: 'demo' | 'jira';
}
