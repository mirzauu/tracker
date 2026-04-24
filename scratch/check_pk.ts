import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function checkPK() {
  try {
    const result = await db.execute(sql`
      SELECT
        a.attname,
        format_type(a.atttypid, a.atttypmod) AS data_type
      FROM
        pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE
        i.indrelid = 'oauth_tokens'::regclass
        AND i.indisprimary;
    `);
    console.log('Current Primary Key columns:', result);
  } catch (err) {
    console.error('Failed to check PK:', err);
  }
}

checkPK();
