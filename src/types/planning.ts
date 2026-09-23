export interface ReadinessItem { text: string; checked: boolean }
export type Readiness = Record<string, ReadinessItem>;
export type ReadinessChange =
  | { operation: 'add'; id: string; text: string }
  | { operation: 'edit'; id: string; text: string }
  | { operation: 'toggle'; id: string; checked: boolean }
  | { operation: 'remove'; id: string }
  | { operation: 'replace'; items: Readiness };

// A small, plain-text snapshot for the whole room. Jira credentials and its
// richer document format belong in the future service adapter, never here.
export interface PlanningTicket {
  key: string;
  title: string;
  description: string;
  team: string;
  status: 'Backlog' | 'Ready' | 'In progress';
  source: 'demo' | 'jira';
}
