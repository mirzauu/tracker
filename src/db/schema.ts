import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, primaryKey, uniqueIndex, date, index } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // 'Free', 'Pro'
  description: text('description'),
  maxGoals: integer('max_goals').notNull().default(5),
  price: integer('price').notNull().default(0), // in cents
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // references auth.users.id
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  planId: uuid('plan_id').references(() => plans.id).notNull(),
  timezone: text('timezone').default('UTC').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // ── Analytics ──────────────────────────────────────────────────────────────
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  loginCount: integer('login_count').default(0).notNull(),
  preferredTheme: text('preferred_theme').default('default'),
  country: text('country'),
  city: text('city'),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // Will make notNull after migration
  name: text('name').notNull(),
  color: text('color').notNull().default('#10b981'), // default emerald color
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userCategoryUnique: uniqueIndex('user_category_unique').on(table.name, table.userId),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  goals: many(goals),
  profile: one(profiles, {
    fields: [categories.userId],
    references: [profiles.id],
  }),
}));

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // Will make notNull after migration
  name: text('name').notNull(),
  mission: text('mission').notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'daily' | 'weekly' | 'monthly'
  target: integer('target').notNull(),
  priority: text('priority').notNull(), // 'low' | 'medium' | 'high'
  reminderOn: boolean('reminder_on').default(false).notNull(),
  reminderTime: text('reminder_time').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // ── Streak & completion tracking ──────────────────────────────────────────
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  totalCompletions: integer('total_completions').default(0).notNull(),
  lastCompletedAt: timestamp('last_completed_at', { withTimezone: true }),
});

export const goalsRelations = relations(goals, ({ one }) => ({
  category: one(categories, {
    fields: [goals.categoryId],
    references: [categories.id],
  }),
  profile: one(profiles, {
    fields: [goals.userId],
    references: [profiles.id],
  }),
}));

export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // Will make notNull after migration
  name: text('name').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const logs = pgTable('logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // Will make notNull after migration
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }).notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  entryKey: text('entry_key').notNull(), // 'day-1', 'week-1', etc.
  value: integer('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const oauth_tokens = pgTable('oauth_tokens', {
  userId: uuid('user_id').notNull(),
  provider: text('provider').notNull(), // e.g., 'google_calendar'
  tokens: text('tokens').notNull(), // JSON string of tokens
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.provider] }),
}));

export const otps = pgTable('otps', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userEndpointUnique: uniqueIndex('user_endpoint_unique').on(table.userId, table.endpoint),
}));

// ── User Sessions ──────────────────────────────────────────────────────────
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  loggedInAt: timestamp('logged_in_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceType: text('device_type'),
  os: text('os'),
  browser: text('browser'),
  country: text('country'),
  city: text('city'),
  timezone: text('timezone'),
  referrer: text('referrer'),
}, (table) => ({
  userIdx: index('user_sessions_user_idx').on(table.userId),
  loginAtIdx: index('user_sessions_login_at_idx').on(table.loggedInAt),
}));

// ── Daily Activity ─────────────────────────────────────────────────────────
export const userActivity = pgTable('user_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  activityDate: date('activity_date').notNull(),
  firstActiveAt: timestamp('first_active_at', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  pageViews: integer('page_views').default(0).notNull(),
  goalsChecked: integer('goals_checked').default(0).notNull(),
  sessionsOnDay: integer('sessions_on_day').default(0).notNull(),
}, (table) => ({
  userDateUnique: uniqueIndex('user_activity_user_date_unique').on(table.userId, table.activityDate),
  userIdx: index('user_activity_user_idx').on(table.userId),
}));

// ── Event Audit Log ────────────────────────────────────────────────────────
// Unified, append-only log of every user action in the app.
export const eventLog = pgTable('event_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  eventType: text('event_type').notNull(),      // e.g. 'goal.created', 'calendar.task_completed'
  targetId: text('target_id'),                   // ID of the entity acted upon (goal_id, event_id, etc.)
  metadata: text('metadata'),                    // JSON string with event-specific details
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('event_log_user_idx').on(table.userId),
  typeIdx: index('event_log_type_idx').on(table.eventType),
  createdAtIdx: index('event_log_created_at_idx').on(table.createdAt),
}));

// ── Goal Snapshots ─────────────────────────────────────────────────────────
// Saves the full goal state before every edit/delete, enabling edit history.
export const goalSnapshots = pgTable('goal_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  goalId: uuid('goal_id').notNull(),             // NOT a FK — goal may be deleted
  action: text('action').notNull(),              // 'created' | 'updated' | 'deleted'
  snapshot: text('snapshot').notNull(),           // JSON string of the full goal state
  changedFields: text('changed_fields'),         // JSON array of field names that changed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  goalIdx: index('goal_snapshots_goal_idx').on(table.goalId),
  userIdx: index('goal_snapshots_user_idx').on(table.userId),
}));

// ── Calendar Task Log ──────────────────────────────────────────────────────
// Tracks every Google Calendar task fetched and whether/when it was completed.
export const calendarTaskLog = pgTable('calendar_task_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  googleEventId: text('google_event_id').notNull(),
  summary: text('summary').notNull(),
  scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
  scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
  isCompleted: boolean('is_completed').default(false).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  wasOnTime: boolean('was_on_time'),             // completed before scheduled end?
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userEventUnique: uniqueIndex('calendar_task_user_event_unique').on(table.userId, table.googleEventId),
  userIdx: index('calendar_task_log_user_idx').on(table.userId),
}));
