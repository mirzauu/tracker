import { db } from '@/db';
import { goals, pushSubscriptions } from '@/db/schema';
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
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.JWT_SECRET;
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const currentHHmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Find all goals with reminders at the current time
    const goalsWithReminders = await db
      .select()
      .from(goals)
      .where(eq(goals.reminderOn, true));

    const matchingGoals = goalsWithReminders.filter(g => g.reminderTime === currentHHmm);

    if (matchingGoals.length === 0) {
      return NextResponse.json({ message: 'No reminders to send', time: currentHHmm });
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
      time: currentHHmm,
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
    const { userId, title, body } = await request.json();

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
      body: body || 'Time to work on your habit!',
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
