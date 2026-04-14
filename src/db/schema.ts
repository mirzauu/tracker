import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

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
  userId: uuid('user_id'), // Will make notNull after migration
  provider: text('provider'), // e.g., 'google_calendar'
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

