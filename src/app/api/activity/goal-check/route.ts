import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { db } from '@/db';
import { userActivity } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    await db
      .insert(userActivity)
      .values({
        userId,
        activityDate: todayStr,
        firstActiveAt: now,
        lastActiveAt: now,
        pageViews: 0,
        goalsChecked: 1,
        sessionsOnDay: 0,
      })
      .onConflictDoUpdate({
        target: [userActivity.userId, userActivity.activityDate],
        set: {
          lastActiveAt: now,
          goalsChecked: sql`${userActivity.goalsChecked} + 1`,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Goal check ping error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
