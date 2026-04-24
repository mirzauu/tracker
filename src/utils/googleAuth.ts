import { google } from 'googleapis';
import { db } from '@/db';
import { oauth_tokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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

export async function getStoredTokens(userId: string) {
  try {
    console.log(`Fetching tokens for user: ${userId}`);
    const result = await db.select()
      .from(oauth_tokens)
      .where(
        and(
          eq(oauth_tokens.provider, 'google_calendar'),
          eq(oauth_tokens.userId, userId)
        )
      )
      .limit(1);
      
    if (result.length > 0) {
      console.log(`Found tokens for user: ${userId}`);
      return JSON.parse(result[0].tokens);
    }
    console.log(`No tokens found for user: ${userId}`);
    return null;
  } catch (error) {
    console.error('Error fetching tokens from DB:', error);
    return null;
  }
}

export async function saveTokens(userId: string, tokens: any) {
  try {
    console.log(`Saving tokens for user: ${userId}`);
    if (!userId) {
      console.error('Cannot save tokens: userId is missing');
      return;
    }
    await db.insert(oauth_tokens)
      .values({
        userId: userId,
        provider: 'google_calendar',
        tokens: JSON.stringify(tokens),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [oauth_tokens.userId, oauth_tokens.provider],
        set: {
          tokens: JSON.stringify(tokens),
          updatedAt: new Date(),
        },
      });
    console.log(`Successfully saved tokens for user: ${userId}`);
  } catch (error) {
    console.error('Error saving tokens to DB:', error);
  }
}

