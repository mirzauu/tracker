import { db } from '@/db';
import { logs, goals } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { revalidatePath } from 'next/cache';
import { trackEvent } from '@/utils/trackEvent';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.userId;

    const { goalId, entryKey, value } = await request.json();

    // Check if a log entry already exists for this goal and key for this user
    const existing = await db
      .select()
      .from(logs)
      .where(and(
        eq(logs.goalId, goalId), 
        eq(logs.entryKey, entryKey),
        eq(logs.userId, userId)
      ))
      .limit(1);

    if (existing.length > 0) {
      if (value === 0) {
        // Unchecking
        await db
          .delete(logs)
          .where(and(
            eq(logs.goalId, goalId), 
            eq(logs.entryKey, entryKey),
            eq(logs.userId, userId)
          ));
        
        // Track uncheck event
        trackEvent(userId, 'goal.unchecked', goalId, { entryKey });
      } else {
        // Update
        await db
          .update(logs)
          .set({ value, entryDate: new Date() })
          .where(and(
            eq(logs.goalId, goalId), 
            eq(logs.entryKey, entryKey),
            eq(logs.userId, userId)
          ));
      }
    } else if (value !== 0) {
      // New completion
      const now = new Date();
      await db.insert(logs).values({
        goalId,
        entryKey,
        value,
        userId,
        entryDate: now,
      });

      // Determine event type from entry key pattern
      let eventType: 'goal.checked' | 'goal.weekly_progress' | 'goal.monthly_update' = 'goal.checked';
      if (entryKey.includes('week')) eventType = 'goal.weekly_progress';
      if (entryKey.includes('month')) eventType = 'goal.monthly_update';

      // Track check event with completion time
      const hour = now.getHours();
      const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      
      trackEvent(userId, eventType, goalId, {
        entryKey,
        value,
        completedAt: now.toISOString(),
        timeOfDay,
        hour,
      });

      // Update goal streak & completion stats
      db.update(goals)
        .set({
          totalCompletions: sql`${goals.totalCompletions} + 1`,
          lastCompletedAt: now,
          currentStreak: sql`${goals.currentStreak} + 1`,
          longestStreak: sql`GREATEST(${goals.longestStreak}, ${goals.currentStreak} + 1)`,
        })
        .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
        .catch((e) => console.error('Failed to update goal streaks:', e));
    }

    revalidatePath('/');
    return NextResponse.json({ success: true });
  } catch (error) {

    console.error('Failed to update log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
