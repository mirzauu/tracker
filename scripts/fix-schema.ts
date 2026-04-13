import './env-loader';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log('Fixing database schema...');
  try {
    // 1. Fix oauth_tokens
    console.log('Checking oauth_tokens...');
    await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id)`;
    console.log('✅ oauth_tokens.user_id added (if missing).');

    // 2. Fix categories unique constraint
    console.log('Fixing categories constraints...');
    // Drop the global unique constraint if it exists
    await sql`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key`;
    await sql`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_unique`;
    
    // Create the per-user unique index
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_category_unique ON categories (name, user_id)`;
    console.log('✅ categories constraints updated to be per-user.');

    console.log('✅ Database fix complete.');
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();
