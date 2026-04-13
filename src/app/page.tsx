export const dynamic = 'force-dynamic';
import { db } from '@/db';
import { logs, goals } from '@/db/schema';
import ClientTracker from './ClientTracker';
import { getSession } from '@/utils/auth';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  const userId = session.userId;

  // Fetch goals with categories belonging to the user
  const allGoalsWithCategory = await db.query.goals.findMany({
    where: eq(goals.userId, userId),
    with: {
      category: true,
    },
  });

  // Fetch logs belonging to the user
  const allLogs = await db.select().from(logs).where(eq(logs.userId, userId));

  // Map database goals to the format Expected by Tracker
  const initialGoals = allGoalsWithCategory.map(g => ({
    id: g.id,
    name: g.name,
    type: g.type as 'daily' | 'weekly' | 'monthly',
    target: g.target,
    category: g.category ? {
      name: g.category.name,
      color: g.category.color
    } : null,
    reminderOn: g.reminderOn,
    reminderTime: g.reminderTime
  }));

  // Map database logs to the format expected by Tracker
  const initialLogs = allLogs.map(l => ({
    id: l.id,
    goalId: l.goalId,
    entryKey: l.entryKey,
    value: l.value
  }));

  return <ClientTracker initialGoals={initialGoals} initialLogs={initialLogs} />;
}
