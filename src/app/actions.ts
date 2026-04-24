'use server';

import { db } from '@/db';
import { goals, categories, profiles, goalSnapshots } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/utils/auth';
import { trackEvent } from '@/utils/trackEvent';

async function getUserId() {
  const session = await getSession();
  return session?.userId;
}

export async function getGoals() {
  const userId = await getUserId();
  if (!userId) return [];
  
  try {
    return await db.query.goals.findMany({
      where: eq(goals.userId, userId),
      orderBy: (goals, { asc }) => [asc(goals.createdAt)],
      with: {
        category: true
      }
    });
  } catch (error) {
    console.error('Failed to fetch goals:', error);
    return [];
  }
}

export async function getCategories() {
  const userId = await getUserId();
  if (!userId) return [];

  try {
    return await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.name);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}

export async function createCategory(name: string, color?: string) {
  const userId = await getUserId();
  if (!userId) return;

  try {
    const [result] = await db.insert(categories).values({ name, color, userId }).returning();
    
    // Track event
    trackEvent(userId, 'category.created', result.id, { name, color });
    
    revalidatePath('/goals');
    return result;
  } catch (error) {
    console.error('Failed to create category:', error);
  }
}

export async function createGoal(data: any) {
  const userId = await getUserId();
  if (!userId) return;

  try {
    const [newGoal] = await db.insert(goals).values({ ...data, userId }).returning();
    
    // Track event + save initial snapshot
    trackEvent(userId, 'goal.created', newGoal.id, {
      name: newGoal.name,
      type: newGoal.type,
      priority: newGoal.priority,
      target: newGoal.target,
      categoryId: newGoal.categoryId,
    });
    
    db.insert(goalSnapshots).values({
      userId,
      goalId: newGoal.id,
      action: 'created',
      snapshot: JSON.stringify(newGoal),
    }).catch((e) => console.error('Failed to save goal snapshot:', e));
    
    revalidatePath('/');
    revalidatePath('/goals');
  } catch (error) {
    console.error('Failed to create goal:', error);
  }
}

export async function updateGoal(id: string, data: any) {
  const userId = await getUserId();
  if (!userId) return;

  try {
    // Fetch current state BEFORE update for snapshot
    const [currentGoal] = await db.select().from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .limit(1);
    
    if (!currentGoal) return;
    
    // Compute changed fields
    const changedFields = Object.keys(data).filter(
      (key) => (currentGoal as any)[key] !== data[key]
    );

    await db.update(goals).set(data).where(and(eq(goals.id, id), eq(goals.userId, userId)));
    
    // Track event + save snapshot of the PREVIOUS state
    trackEvent(userId, 'goal.updated', id, {
      changedFields,
      before: Object.fromEntries(changedFields.map(k => [k, (currentGoal as any)[k]])),
      after: Object.fromEntries(changedFields.map(k => [k, data[k]])),
    });
    
    db.insert(goalSnapshots).values({
      userId,
      goalId: id,
      action: 'updated',
      snapshot: JSON.stringify(currentGoal),
      changedFields: JSON.stringify(changedFields),
    }).catch((e) => console.error('Failed to save goal snapshot:', e));
    
    revalidatePath('/');
    revalidatePath('/goals');
  } catch (error) {
    console.error('Failed to update goal:', error);
  }
}

export async function deleteGoal(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  try {
    // Fetch goal before deleting for snapshot
    const [goalToDelete] = await db.select().from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .limit(1);
    
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
    
    // Track event + save final snapshot
    if (goalToDelete) {
      trackEvent(userId, 'goal.deleted', id, {
        name: goalToDelete.name,
        type: goalToDelete.type,
        totalCompletions: goalToDelete.totalCompletions,
        longestStreak: goalToDelete.longestStreak,
      });
      
      db.insert(goalSnapshots).values({
        userId,
        goalId: id,
        action: 'deleted',
        snapshot: JSON.stringify(goalToDelete),
      }).catch((e) => console.error('Failed to save goal snapshot:', e));
    }
    
    revalidatePath('/');
    revalidatePath('/goals');
  } catch (error) {
    console.error('Failed to delete goal:', error);
  }
}

export async function updateUserTimezone(timezone: string) {
  const userId = await getUserId();
  if (!userId) return;

  try {
    await db.update(profiles).set({ timezone }).where(eq(profiles.id, userId));
  } catch (error) {
    console.error('Failed to update timezone:', error);
  }
}
