export const dynamic = 'force-dynamic';
import { db } from '@/db';
import { goals, logs } from '@/db/schema';
import ClientTracker from './ClientTracker';

export default async function Page() {
  // Fetch goals with categories and logs from the database
  const allGoalsWithCategory = await db.query.goals.findMany({
    with: {
      category: true,
    },
  });
  const allLogs = await db.select().from(logs);

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
