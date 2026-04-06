import { db } from '@/db';
import { logs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { goalId, entryKey, value } = await request.json();

    // Check if a log entry already exists for this goal and key
    const existing = await db
      .select()
      .from(logs)
      .where(and(eq(logs.goalId, goalId), eq(logs.entryKey, entryKey)))
      .limit(1);

    if (existing.length > 0) {
      if (value === 0) {
        // Delete if value is 0 (optional design choice, match UI logic)
        await db
          .delete(logs)
          .where(and(eq(logs.goalId, goalId), eq(logs.entryKey, entryKey)));
      } else {
        // Update
        await db
          .update(logs)
          .set({ value, entryDate: new Date() })
          .where(and(eq(logs.goalId, goalId), eq(logs.entryKey, entryKey)));
      }
    } else if (value !== 0) {
      // Create new
      await db.insert(logs).values({
        goalId,
        entryKey,
        value,
        entryDate: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
