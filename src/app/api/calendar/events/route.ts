import { google } from 'googleapis';
import { oauth2Client, getStoredTokens, saveTokens } from '@/utils/googleAuth';
import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { trackEvent } from '@/utils/trackEvent';
import { db } from '@/db';
import { calendarTaskLog } from '@/db/schema';
import { sql } from 'drizzle-orm';

async function getUser() {
  const session = await getSession();
  if (!session) return null;
  return { id: session.userId };
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      console.log('Calendar API: No user in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Calendar API: Fetching tokens for user ${user.id}`);
    const tokens = await getStoredTokens(user.id);
    if (!tokens) {
      console.log(`Calendar API: No tokens found for user ${user.id}`);
      return NextResponse.json({ authenticated: false, events: [] });
    }

    oauth2Client.setCredentials(tokens);

    // Refresh token if expired
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      const refreshed = await oauth2Client.refreshAccessToken();
      const updatedTokens = { ...tokens, ...refreshed.credentials };
      await saveTokens(user.id, updatedTokens);
      oauth2Client.setCredentials(updatedTokens);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Set time range for today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Log each calendar task into calendar_task_log (upsert)
    for (const event of events) {
      if (!event.id || !event.summary) continue;
      db.insert(calendarTaskLog).values({
        userId: user.id,
        googleEventId: event.id,
        summary: event.summary || 'Untitled',
        scheduledStart: event.start?.dateTime ? new Date(event.start.dateTime) : null,
        scheduledEnd: event.end?.dateTime ? new Date(event.end.dateTime) : null,
        isCompleted: event.summary?.startsWith('✅') || false,
        firstSeenAt: now,
        lastSeenAt: now,
      }).onConflictDoUpdate({
        target: [calendarTaskLog.userId, calendarTaskLog.googleEventId],
        set: {
          summary: event.summary || 'Untitled',
          lastSeenAt: now,
          isCompleted: event.summary?.startsWith('✅') || false,
        },
      }).catch((e) => console.error('Failed to upsert calendar task:', e));
    }

    // Track fetch event
    trackEvent(user.id, 'calendar.tasks_fetched', null, { count: events.length });
    
    return NextResponse.json({ 
      authenticated: true, 
      events: events.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        color: event.colorId,
      }))
    });
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    if (error.code === 403 || error.message?.includes('insufficient authentication scopes')) {
        return NextResponse.json({ authenticated: false, reauth: true, error: 'Insufficient permissions. Please reconnect your calendar.' });
    }
    return NextResponse.json({ authenticated: false, events: [], error: 'Failed to fetch events' });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tokens = await getStoredTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ authenticated: false, error: 'Not authenticated' }, { status: 401 });
    }
    oauth2Client.setCredentials(tokens);

    // Refresh token if expired
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      const refreshed = await oauth2Client.refreshAccessToken();
      const updatedTokens = { ...tokens, ...refreshed.credentials };
      await saveTokens(user.id, updatedTokens);
      oauth2Client.setCredentials(updatedTokens);
    }


    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });

    const currentSummary = event.data.summary || '';
    const newSummary = currentSummary.startsWith('✅') ? currentSummary : `✅ ${currentSummary}`;

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: {
        summary: newSummary,
        colorId: '8', // Grey color
      },
    });

    // Track calendar task completion
    const completedAt = new Date();
    const scheduledEnd = event.data.end?.dateTime ? new Date(event.data.end.dateTime) : null;
    const wasOnTime = scheduledEnd ? completedAt <= scheduledEnd : null;

    trackEvent(user.id, 'calendar.task_completed', eventId, {
      summary: newSummary,
      completedAt: completedAt.toISOString(),
      wasOnTime,
    });

    // Update calendar_task_log
    db.insert(calendarTaskLog).values({
      userId: user.id,
      googleEventId: eventId,
      summary: newSummary,
      scheduledStart: event.data.start?.dateTime ? new Date(event.data.start.dateTime) : null,
      scheduledEnd,
      isCompleted: true,
      completedAt,
      wasOnTime,
      firstSeenAt: completedAt,
      lastSeenAt: completedAt,
    }).onConflictDoUpdate({
      target: [calendarTaskLog.userId, calendarTaskLog.googleEventId],
      set: {
        isCompleted: true,
        completedAt,
        wasOnTime,
        summary: newSummary,
        lastSeenAt: completedAt,
      },
    }).catch((e) => console.error('Failed to update calendar task log:', e));

    return NextResponse.json({ success: true, newSummary });
  } catch (error: any) {
    console.error('Error updating event:', error);
    if (error.code === 403 || error.message?.includes('insufficient authentication scopes')) {
        return NextResponse.json({ reauth: true, error: 'Insufficient permissions. Please reconnect your calendar.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update event', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { summary } = await request.json();

    if (!summary) {
      return NextResponse.json({ error: 'Missing summary' }, { status: 400 });
    }

    const tokens = await getStoredTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ authenticated: false, error: 'Not authenticated' }, { status: 401 });
    }

    oauth2Client.setCredentials(tokens);

    // Refresh token if expired
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      const refreshed = await oauth2Client.refreshAccessToken();
      const updatedTokens = { ...tokens, ...refreshed.credentials };
      await saveTokens(user.id, updatedTokens);
      oauth2Client.setCredentials(updatedTokens);
    }


    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60000); // 30 mins later

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: summary,
        start: { dateTime: now.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });

    const event = response.data;
    
    // Track calendar task creation
    trackEvent(user.id, 'calendar.task_created', event.id || null, {
      summary: event.summary,
      scheduledStart: now.toISOString(),
      scheduledEnd: end.toISOString(),
    });

    // Log to calendar_task_log
    if (event.id) {
      db.insert(calendarTaskLog).values({
        userId: user.id,
        googleEventId: event.id,
        summary: event.summary || summary,
        scheduledStart: now,
        scheduledEnd: end,
        isCompleted: false,
        firstSeenAt: now,
        lastSeenAt: now,
      }).catch((e) => console.error('Failed to log calendar task creation:', e));
    }

    return NextResponse.json({ 
      success: true, 
      event: {
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
      } 
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    if (error.code === 403 || error.message?.includes('insufficient authentication scopes')) {
        return NextResponse.json({ reauth: true, error: 'Insufficient permissions. Please reconnect your calendar.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
  }
}



