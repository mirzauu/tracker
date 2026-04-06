import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#10b981'), // default emerald color
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  goals: many(goals),
}));

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
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
}));

export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const logs = pgTable('logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }).notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  entryKey: text('entry_key').notNull(), // 'day-1', 'week-1', etc.
  value: integer('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
