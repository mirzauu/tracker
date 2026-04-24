import { db } from '../src/db';
import { oauth_tokens } from '../src/db/schema';

async function insertDummy() {
  try {
    const userId = '26771a3f-6d67-46a2-8e0f-3a16d4488cf6';
    const tokens = { access_token: 'dummy', expiry_date: Date.now() + 3600000 };
    
    console.log(`Inserting dummy token for ${userId}`);
    await db.insert(oauth_tokens).values({
      userId,
      provider: 'google_calendar',
      tokens: JSON.stringify(tokens),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [oauth_tokens.userId, oauth_tokens.provider],
      set: { tokens: JSON.stringify(tokens), updatedAt: new Date() }
    });
    console.log('Done.');
  } catch (err) {
    console.error('Error inserting dummy:', err);
  }
}

insertDummy();
