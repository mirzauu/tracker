import { google } from 'googleapis';
import { db } from '@/db';
import { oauth_tokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

export const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
];

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function getStoredTokens() {
  try {
    const result = await db.select().from(oauth_tokens).where(eq(oauth_tokens.provider, 'google_calendar')).limit(1);
    if (result.length > 0) {
      return JSON.parse(result[0].tokens);
    }
    return null;
  } catch (error) {
    console.error('Error fetching tokens from DB:', error);
    return null;
  }
}

export async function saveTokens(tokens: any) {
  try {
    await db.insert(oauth_tokens)
      .values({
        provider: 'google_calendar',
        tokens: JSON.stringify(tokens),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: oauth_tokens.provider,
        set: {
          tokens: JSON.stringify(tokens),
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error saving tokens to DB:', error);
  }
}

