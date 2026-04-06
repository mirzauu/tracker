import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { goals, todos, categories, logs } from '../src/db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log('Clearing database...');
  await db.delete(logs);
  await db.delete(todos);
  await db.delete(goals);
  await db.delete(categories);

  console.log('Seeding database...');

  const [healthCat, growthCat] = await db.insert(categories).values([
    { name: 'Health', color: '#10b981' },
    { name: 'Personal Growth', color: '#3b82f6' },
  ]).returning();

  const insertedGoals = await db.insert(goals).values([
    {
      name: 'Morning Workout',
      mission: 'Build physical discipline',
      categoryId: healthCat.id,
      type: 'daily',
      target: 1,
      priority: 'high',
      reminderOn: true,
      reminderTime: '11:58',
    },
    {
      name: 'Read 20 Pages',
      mission: 'Expand knowledge',
      categoryId: growthCat.id,
      type: 'daily',
      target: 1,
      priority: 'medium',
      reminderOn: false,
      reminderTime: '21:00',
    },
    {
      name: 'Run 5km',
      mission: 'Cardio health',
      categoryId: healthCat.id,
      type: 'weekly',
      target: 3,
      priority: 'high',
      reminderOn: true,
      reminderTime: '08:00',
    },
    {
       name: 'Learn Drizzle',
       mission: 'Improve dev skills',
       categoryId: growthCat.id,
       type: 'daily',
       target: 1,
       priority: 'medium',
       reminderOn: true,
       reminderTime: '11:55',
    }
  ]).returning();

  const workoutGoal = insertedGoals.find(g => g.name === 'Morning Workout')!;
  const runGoal = insertedGoals.find(g => g.name === 'Run 5km')!;

  await db.insert(logs).values([
    { goalId: workoutGoal.id, entryDate: new Date('2026-04-01T07:00:00Z'), entryKey: '2026-04-day-1', value: 1 },
    { goalId: workoutGoal.id, entryDate: new Date('2026-04-02T07:00:00Z'), entryKey: '2026-04-day-2', value: 1 },
    { goalId: workoutGoal.id, entryDate: new Date('2026-04-03T07:00:00Z'), entryKey: '2026-04-day-3', value: 1 },
    { goalId: runGoal.id, entryDate: new Date('2026-04-07T08:00:00Z'), entryKey: '2026-04-w1', value: 1 },
    { goalId: runGoal.id, entryDate: new Date('2026-04-14T08:00:00Z'), entryKey: '2026-04-w2', value: 2 },
  ]);

  await db.insert(todos).values([
    { name: 'Fix styling' },
    { name: 'Group goals by category' },
    { name: 'Finalize migrations' },
  ]);

  console.log('Seed completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
