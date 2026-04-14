import { db } from '@/db';
import { goals, pushSubscriptions, profiles } from '@/db/schema';
import { getSession } from '@/utils/auth';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  'mailto:hello@paperpie.io',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// This endpoint is called periodically (e.g., via cron) to check reminders and send push notifications
// Call it with a secret key to prevent unauthorized access
export async function GET(request: NextRequest) {
  console.log('--- PUSH REMINDER CHECK TRIGGERED ---');
  const authHeader = request.headers.get('authorization');
  const vercelCron = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET || process.env.JWT_SECRET;
  
  // Allow if Bearer token matches OR if it's a verified Vercel cron request
  if (authHeader !== `Bearer ${cronSecret}` && vercelCron !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    // Find all goals with reminders
    // Join with profiles to get the user's timezone
    const goalsWithReminders = await db
      .select({
        id: goals.id,
        name: goals.name,
        userId: goals.userId,
        reminderTime: goals.reminderTime,
        timezone: profiles.timezone,
      })
      .from(goals)
      .innerJoin(profiles, eq(goals.userId, profiles.id))
      .where(eq(goals.reminderOn, true));

    const matchingGoals = goalsWithReminders.filter(g => {
      // Calculate current time in user's timezone
      try {
        const userTime = new Intl.DateTimeFormat('en-US', {
          timeZone: g.timezone || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(now);
        
        const matches = userTime === g.reminderTime;
        
        console.log(`[PushCheck] Goal: "${g.name}", UserTZ: ${g.timezone}, LocalTime: ${userTime}, TargetTime: ${g.reminderTime}, Match: ${matches}`);
        
        return matches;
      } catch (e) {
        console.error(`Invalid timezone for user ${g.userId}: ${g.timezone}`);
        // Fallback to UTC if timezone is invalid
        const utcTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(now);
        
        const matches = utcTime === g.reminderTime;
        console.log(`[PushCheck] FALLBACK UTC - Goal: "${g.name}", TargetTime: ${g.reminderTime}, Match: ${matches}`);
        return matches;
      }
    });

    if (matchingGoals.length === 0) {
      return NextResponse.json({ message: 'No reminders to send at this time' });
    }

    // Group goals by user
    const goalsByUser: Record<string, typeof matchingGoals> = {};
    matchingGoals.forEach(goal => {
      const userId = goal.userId || 'unknown';
      if (!goalsByUser[userId]) goalsByUser[userId] = [];
      goalsByUser[userId].push(goal);
    });

    let sent = 0;
    let failed = 0;

    for (const [userId, userGoals] of Object.entries(goalsByUser)) {
      if (userId === 'unknown') continue;

      // Get all push subscriptions for this user
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      if (subscriptions.length === 0) continue;

      for (const goal of userGoals) {
        const payload = JSON.stringify({
          title: '🔔 Habit Reminder',
          body: `Time for "${goal.name}"!`,
          url: '/',
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              payload
            );
            console.log(`[PushSent] Successfully sent notification to user ${userId} for goal "${goal.name}"`);
            sent++;
          } catch (error: any) {
            console.error(`Push failed for sub ${sub.id}:`, error.statusCode);
            failed++;
            // Remove invalid subscriptions (410 Gone or 404)
            if (error.statusCode === 410 || error.statusCode === 404) {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      message: `Sent ${sent} notifications, ${failed} failed`,
      goalsMatched: matchingGoals.length,
    });
  } catch (error) {
    console.error('Cron push check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Manual trigger: send a push notification for a specific goal (for testing)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let userId = body.userId;
    const { title, body: msgBody } = body;

    if (!userId) {
      const session = await getSession();
      userId = session?.userId;
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      return NextResponse.json({ error: 'No subscriptions found for user' }, { status: 404 });
    }

    const payload = JSON.stringify({
      title: title || '🔔 Habit Reminder',
      body: msgBody || 'Time to work on your habit!',
      url: '/',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error('Manual push send error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
