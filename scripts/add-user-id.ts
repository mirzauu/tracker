import './env-loader';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log('Adding missing user_id columns...');
  try {
    await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id)`;
    console.log('✅ categories.user_id added.');

    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id)`;
    console.log('✅ goals.user_id added.');

    // Also check logs and todos if they exist
    await sql`ALTER TABLE logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id)`;
    console.log('✅ logs.user_id added.');

    await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id)`;
    console.log('✅ todos.user_id added.');

    console.log('✅ All missing columns added.');
  } catch (error) {
    console.error('❌ Error updating tables:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();
