import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { db } from '@/db';
import { calendarTaskLog } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { searchParams } = new URL(request.url);
    
    // Allow specifying a reference date, default to today
    const refDateStr = searchParams.get('date');
    const refDate = refDateStr ? new Date(refDateStr) : new Date();
    
    // Calculate 30-day window: 29 days before refDate + refDate itself
    const endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);

    // Query calendar_task_log for the 30-day window
    const rows = await db
      .select({
        day: sql<string>`DATE(${calendarTaskLog.scheduledStart} AT TIME ZONE 'UTC')`.as('day'),
        total: sql<number>`COUNT(*)::int`.as('total'),
        completed: sql<number>`COUNT(*) FILTER (WHERE ${calendarTaskLog.isCompleted} = true)::int`.as('completed'),
      })
      .from(calendarTaskLog)
      .where(
        and(
          eq(calendarTaskLog.userId, userId),
          gte(calendarTaskLog.scheduledStart, startDate),
          lte(calendarTaskLog.scheduledStart, endDate)
        )
      )
      .groupBy(sql`DATE(${calendarTaskLog.scheduledStart} AT TIME ZONE 'UTC')`)
      .orderBy(sql`DATE(${calendarTaskLog.scheduledStart} AT TIME ZONE 'UTC')`);

    // Build a full 30-day array (fill in zeros for days with no data)
    const progressData: { date: string; total: number; completed: number }[] = [];
    const dataMap = new Map<string, { total: number; completed: number }>();

    for (const row of rows) {
      if (row.day) {
        dataMap.set(row.day, { total: row.total, completed: row.completed });
      }
    }

    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = dataMap.get(key);
      progressData.push({
        date: key,
        total: existing?.total ?? 0,
        completed: existing?.completed ?? 0,
      });
    }

    return NextResponse.json({ progress: progressData });
  } catch (error: any) {
    console.error('Error fetching calendar progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress data', details: error.message },
      { status: 500 }
    );
  }
}
