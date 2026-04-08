import { google } from 'googleapis';
import { oauth2Client, getStoredTokens, saveTokens } from '@/utils/googleAuth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) {
      return NextResponse.json({ authenticated: false, events: [] });
    }

    oauth2Client.setCredentials(tokens);

    // Refresh token if expired
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      const refreshed = await oauth2Client.refreshAccessToken();
      const updatedTokens = { ...tokens, ...refreshed.credentials };
      await saveTokens(updatedTokens);
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
    
    return NextResponse.json({ 
      authenticated: true, 
      events: events.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        color: event.colorId, // Optional: handle colors if needed
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
    const tokens = await getStoredTokens();
    if (!tokens) {
      return NextResponse.json({ authenticated: false, error: 'Not authenticated' }, { status: 401 });
    }
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // First get the current event to preserve its summary
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
    const { summary } = await request.json();

    if (!summary) {
      return NextResponse.json({ error: 'Missing summary' }, { status: 400 });
    }

    const tokens = await getStoredTokens();
    if (!tokens) {
      return NextResponse.json({ authenticated: false, error: 'Not authenticated' }, { status: 401 });
    }

    oauth2Client.setCredentials(tokens);

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



