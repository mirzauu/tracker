'use server';

import { db } from '@/db';
import { goals, categories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getGoals() {
  try {
    return await db.query.goals.findMany({
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
  try {
    return await db.select().from(categories).orderBy(categories.name);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}

export async function createCategory(name: string, color?: string) {
  try {
    const [result] = await db.insert(categories).values({ name, color }).returning();
    revalidatePath('/goals');
    return result;
  } catch (error) {
    console.error('Failed to create category:', error);
  }
}

export async function createGoal(data: any) {
  try {
    await db.insert(goals).values(data);
    revalidatePath('/');
    revalidatePath('/goals');
  } catch (error) {
    console.error('Failed to create goal:', error);
  }
}

export async function updateGoal(id: string, data: any) {
  try {
    await db.update(goals).set(data).where(eq(goals.id, id));
    revalidatePath('/');
    revalidatePath('/goals');
  } catch (error) {
    console.error('Failed to update goal:', error);
  }
}

export async function deleteGoal(id: string) {
  try {
    await db.delete(goals).where(eq(goals.id, id));
    revalidatePath('/');
    revalidatePath('/goals');
  } catch (error) {
    console.error('Failed to delete goal:', error);
  }
}
