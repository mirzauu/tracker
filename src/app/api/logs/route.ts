import { db } from '@/db';
import { logs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

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
        // Delete if value is 0 (optional design choice, match UI logic)
        await db
          .delete(logs)
          .where(and(
            eq(logs.goalId, goalId), 
            eq(logs.entryKey, entryKey),
            eq(logs.userId, userId)
          ));
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
      // Create new
      await db.insert(logs).values({
        goalId,
        entryKey,
        value,
        userId,
        entryDate: new Date(),
      });
    }

    revalidatePath('/');
    return NextResponse.json({ success: true });
  } catch (error) {

    console.error('Failed to update log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

