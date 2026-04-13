import './env-loader';
import { db } from '@/db';
import { plans } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Initializing SaaS plans...');

  const freePlan = {
    name: 'Free',
    description: 'Basic features for personal use',
    maxGoals: 5,
    price: 0,
  };

  try {
    const existing = await db.select().from(plans).where(eq(plans.name, 'Free')).limit(1);
    
    if (existing.length === 0) {
      await db.insert(plans).values(freePlan);
      console.log('✅ Free plan created.');
    } else {
      console.log('ℹ️ Free plan already exists.');
    }
  } catch (error) {
    console.error('❌ Error initializing plans:', error);
  }

  process.exit(0);
}

main();
