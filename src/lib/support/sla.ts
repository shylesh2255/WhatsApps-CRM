export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

const SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

export function computeSlaDueAt(priority: TicketPriority, from: Date = new Date()): string {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}
