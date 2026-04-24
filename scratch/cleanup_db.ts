import { db } from '../src/db';
import { oauth_tokens } from '../src/db/schema';
import { isNull } from 'drizzle-orm';

async function cleanup() {
  try {
    console.log('Cleaning up null userIds in oauth_tokens...');
    const deleted = await db.delete(oauth_tokens).where(isNull(oauth_tokens.userId)).returning();
    console.log(`Deleted ${deleted.length} invalid records.`);
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

cleanup();
