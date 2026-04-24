import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString || connectionString.includes('user:password@localhost')) {
  console.error('❌ ERROR: DATABASE_URL is not configured or is using the default placeholder.');
  console.error('Please update .env.local with your real database connection string.');
}

let client;
try {
  // Check if it's a valid-looking URL before passing to driver
  if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
    throw new Error('Invalid protocol');
  }
  client = postgres(connectionString);
} catch (e) {
  console.error('❌ ERROR: Failed to initialize postgres client. Invalid DATABASE_URL.');
  // Use a safe placeholder to prevent immediate crash, though queries will fail
  client = postgres('postgresql://localhost:5432/placeholder'); 
}
export const db = drizzle(client, { schema });
