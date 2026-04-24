import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running analytics migration...');

  // 1. Add new columns to profiles
  const profileColumns = [
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_theme TEXT DEFAULT 'default'`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT`,
  ];

  for (const stmt of profileColumns) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`✅ ${stmt.slice(0, 60)}...`);
    } catch (e: any) {
      console.log(`⚠️  ${e.message.slice(0, 80)}`);
    }
  }

  // 2. Create user_sessions table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        device_type TEXT,
        os TEXT,
        browser TEXT,
        country TEXT,
        city TEXT,
        timezone TEXT,
        referrer TEXT
      );
    `);
    console.log('✅ Created user_sessions table');
  } catch (e: any) {
    console.log(`⚠️  user_sessions: ${e.message.slice(0, 80)}`);
  }

  // 3. Create indexes for user_sessions
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_sessions_login_at_idx ON user_sessions(logged_in_at);`);
    console.log('✅ Created user_sessions indexes');
  } catch (e: any) {
    console.log(`⚠️  user_sessions indexes: ${e.message.slice(0, 80)}`);
  }

  // 4. Create user_activity table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        activity_date DATE NOT NULL,
        first_active_at TIMESTAMPTZ,
        last_active_at TIMESTAMPTZ,
        page_views INTEGER NOT NULL DEFAULT 0,
        goals_checked INTEGER NOT NULL DEFAULT 0,
        sessions_on_day INTEGER NOT NULL DEFAULT 0,
        UNIQUE (user_id, activity_date)
      );
    `);
    console.log('✅ Created user_activity table');
  } catch (e: any) {
    console.log(`⚠️  user_activity: ${e.message.slice(0, 80)}`);
  }

  // 5. Create indexes for user_activity
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_activity_user_idx ON user_activity(user_id);`);
    console.log('✅ Created user_activity indexes');
  } catch (e: any) {
    console.log(`⚠️  user_activity indexes: ${e.message.slice(0, 80)}`);
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
