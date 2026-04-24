import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running tracking migration v2...');

  // 1. Add streak columns to goals
  const goalColumns = [
    `ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE goals ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE goals ADD COLUMN IF NOT EXISTS total_completions INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ`,
  ];

  for (const stmt of goalColumns) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`✅ ${stmt.slice(0, 70)}...`);
    } catch (e: any) {
      console.log(`⚠️  ${e.message?.slice(0, 80)}`);
    }
  }

  // 2. Create event_log table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS event_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        target_id TEXT,
        metadata TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS event_log_user_idx ON event_log(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS event_log_type_idx ON event_log(event_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS event_log_created_at_idx ON event_log(created_at);`);
    console.log('✅ Created event_log table + indexes');
  } catch (e: any) {
    console.log(`⚠️  event_log: ${e.message?.slice(0, 80)}`);
  }

  // 3. Create goal_snapshots table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS goal_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        goal_id UUID NOT NULL,
        action TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        changed_fields TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS goal_snapshots_goal_idx ON goal_snapshots(goal_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS goal_snapshots_user_idx ON goal_snapshots(user_id);`);
    console.log('✅ Created goal_snapshots table + indexes');
  } catch (e: any) {
    console.log(`⚠️  goal_snapshots: ${e.message?.slice(0, 80)}`);
  }

  // 4. Create calendar_task_log table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS calendar_task_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        google_event_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        scheduled_start TIMESTAMPTZ,
        scheduled_end TIMESTAMPTZ,
        is_completed BOOLEAN NOT NULL DEFAULT false,
        completed_at TIMESTAMPTZ,
        was_on_time BOOLEAN,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, google_event_id)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS calendar_task_log_user_idx ON calendar_task_log(user_id);`);
    console.log('✅ Created calendar_task_log table + indexes');
  } catch (e: any) {
    console.log(`⚠️  calendar_task_log: ${e.message?.slice(0, 80)}`);
  }

  console.log('\nMigration v2 complete!');
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
