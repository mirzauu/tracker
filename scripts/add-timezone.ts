import './env-loader';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log('Adding timezone column to profiles...');
  try {
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC' NOT NULL`;
    console.log('✅ Column added successfully.');
  } catch (error) {
    console.error('❌ Error adding column:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();
