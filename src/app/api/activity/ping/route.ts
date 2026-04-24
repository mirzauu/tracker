import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { db } from '@/db';
import { profiles, userActivity } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // Update last_seen_at on profile (fire and forget style - don't block)
    db.update(profiles)
      .set({ lastSeenAt: now })
      .where(eq(profiles.id, userId))
      .catch((e) => console.error('Failed to update last_seen_at:', e));

    // Upsert today's activity row
    await db
      .insert(userActivity)
      .values({
        userId,
        activityDate: todayStr,
        firstActiveAt: now,
        lastActiveAt: now,
        pageViews: 1,
        goalsChecked: 0,
        sessionsOnDay: 0,
      })
      .onConflictDoUpdate({
        target: [userActivity.userId, userActivity.activityDate],
        set: {
          lastActiveAt: now,
          pageViews: sql`${userActivity.pageViews} + 1`,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Activity ping error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
