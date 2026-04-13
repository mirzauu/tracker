import './env-loader';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  try {
    const tables = ['categories', 'goals', 'oauth_tokens'];
    for (const table of tables) {
      const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table}`;
      console.log(`${table} columns:`, cols.map(c => c.column_name));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
