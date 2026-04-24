/**
 * Central event tracking utility.
 * All user actions flow through this single function into the event_log table.
 * Fire-and-forget — never blocks the main action.
 */
import { db } from '@/db';
import { eventLog } from '@/db/schema';

export type EventType =
  // Goal lifecycle
  | 'goal.created'
  | 'goal.updated'
  | 'goal.deleted'
  // Goal completion
  | 'goal.checked'
  | 'goal.unchecked'
  | 'goal.weekly_progress'
  | 'goal.monthly_update'
  // Calendar
  | 'calendar.task_completed'
  | 'calendar.task_created'
  | 'calendar.tasks_fetched'
  | 'calendar.connected'
  | 'calendar.disconnected'
  // UI / Settings
  | 'theme.changed'
  | 'category.created'
  | 'page.viewed'
  | 'notification.toggled'
  // Session
  | 'session.started'
  | 'session.ended';

/**
 * Log a user event. Fire-and-forget — errors are swallowed and logged.
 */
export function trackEvent(
  userId: string,
  eventType: EventType,
  targetId?: string | null,
  metadata?: Record<string, any> | null,
) {
  db.insert(eventLog)
    .values({
      userId,
      eventType,
      targetId: targetId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .catch((err) => console.error(`[trackEvent] ${eventType} failed:`, err));
}
