import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function fixPK() {
  try {
    console.log('Fixing Primary Key for oauth_tokens...');
    
    // 1. Drop existing PK
    // We need the constraint name. Usually it's 'oauth_tokens_pkey'
    try {
      await db.execute(sql`ALTER TABLE oauth_tokens DROP CONSTRAINT oauth_tokens_pkey;`);
      console.log('Dropped old PK.');
    } catch (e) {
      console.log('Could not drop oauth_tokens_pkey, trying generic approach...');
      // Try to find the constraint name dynamically
      const nameRes = await db.execute(sql`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'oauth_tokens'::regclass AND contype = 'p';
      `);
      if (nameRes.length > 0) {
        const conname = (nameRes[0] as any).conname;
        await db.execute(sql`ALTER TABLE oauth_tokens DROP CONSTRAINT ${sql.raw(conname)};`);
        console.log(`Dropped old PK: ${conname}`);
      }
    }

    // 2. Create new PK
    await db.execute(sql`ALTER TABLE oauth_tokens ADD PRIMARY KEY (user_id, provider);`);
    console.log('Created new composite PK (user_id, provider).');
    
  } catch (err) {
    console.error('Failed to fix PK:', err);
  }
}

fixPK();
