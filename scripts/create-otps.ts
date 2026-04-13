import './env-loader';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log('Creating otps table...');
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('✅ otps table created.');
  } catch (error) {
    console.error('❌ Error creating otps table:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();
