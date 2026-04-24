import { db } from '../src/db';
import { oauth_tokens, profiles } from '../src/db/schema';

async function checkTokens() {
  try {
    const allTokens = await db.select().from(oauth_tokens);
    console.log('Total tokens in DB:', allTokens.length);
    allTokens.forEach(t => {
      console.log(`User: ${t.userId}, Provider: ${t.provider}, Updated: ${t.updatedAt}`);
    });

    const allProfiles = await db.select().from(profiles).limit(5);
    console.log('\nSample profiles in DB:');
    allProfiles.forEach(p => {
      console.log(`ID: ${p.id}, Email: ${p.email}`);
    });

  } catch (err) {
    console.error('Error checking tokens:', err);
  }
}

checkTokens();
