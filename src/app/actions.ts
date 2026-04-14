'use server';

import { db } from '@/db';
import { goals, categories, profiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/utils/auth';

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
    await db.insert(goals).values({ ...data, userId });
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
    await db.update(goals).set(data).where(and(eq(goals.id, id), eq(goals.userId, userId)));
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
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
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
