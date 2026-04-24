import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { trackEvent } from '@/utils/trackEvent';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventType, data } = await request.json();

    switch (eventType) {
      case 'theme.changed': {
        trackEvent(session.userId, 'theme.changed', null, {
          from: data.from,
          to: data.to,
        });
        // Persist preferred theme to profile
        db.update(profiles)
          .set({ preferredTheme: data.to })
          .where(eq(profiles.id, session.userId))
          .catch((e) => console.error('Failed to save preferred theme:', e));
        break;
      }
      case 'page.viewed': {
        trackEvent(session.userId, 'page.viewed', null, {
          path: data.path,
        });
        break;
      }
      case 'notification.toggled': {
        trackEvent(session.userId, 'notification.toggled', null, {
          enabled: data.enabled,
        });
        break;
      }
      case 'calendar.connected': {
        trackEvent(session.userId, 'calendar.connected');
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track event error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
