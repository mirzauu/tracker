import { db } from '../src/db';
import { oauth_tokens } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function finalCleanup() {
  try {
    const userId = '26771a3f-6d67-46a2-8e0f-3a16d4488cf6';
    await db.delete(oauth_tokens).where(eq(oauth_tokens.userId, userId));
    console.log('Cleaned up dummy token.');
  } catch (err) {
    console.error('Final cleanup failed:', err);
  }
}

finalCleanup();
