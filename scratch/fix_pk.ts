import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function fixSchema() {
  try {
    console.log('Manually creating primary key for oauth_tokens...');
    // In case the PK already exists partially or there's a conflict
    await db.execute(sql`ALTER TABLE oauth_tokens ADD PRIMARY KEY (user_id, provider);`);
    console.log('Success.');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('Primary key already exists.');
    } else {
      console.error('Failed to create PK:', err);
    }
  }
}

fixSchema();
