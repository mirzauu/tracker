'use server';

import { db } from '@/db';
import { otps, profiles, plans, categories, goals } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { sendOtpEmail } from '@/utils/mail';
import { createSession } from '@/utils/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function requestOtp(formData: FormData) {
  const email = formData.get('email') as string;
  if (!email) return { error: 'Email is required' };

  // Generate 6 digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Save OTP to DB
    await db.insert(otps).values({
      email,
      code,
      expiresAt,
    });

    // Send Email
    await sendOtpEmail(email, code);
    
    return { success: 'OTP sent to your email', email };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { error: 'Failed to send OTP' };
  }
}

export async function verifyOtp(formData: FormData) {
  const email = formData.get('email') as string;
  const code = formData.get('code') as string;
  const fullName = formData.get('fullName') as string; // Optional during login, required during signup

  if (!email || !code) return { error: 'Email and code are required' };

  try {
    // Verify OTP
    const [validOtp] = await db.select()
      .from(otps)
      .where(
        and(
          eq(otps.email, email),
          eq(otps.code, code),
          gt(otps.expiresAt, new Date())
        )
      )
      .orderBy(otps.createdAt)
      .limit(1);

    if (!validOtp) {
      return { error: 'Invalid or expired OTP' };
    }

    // OTP verified, now handle user profile
    let [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);

    if (!profile) {
      // Create new user if they don't exist
      const [freePlan] = await db.select().from(plans).where(eq(plans.name, 'Free')).limit(1);
      
      const [newProfile] = await db.insert(profiles).values({
        id: crypto.randomUUID(),
        email,
        fullName: fullName || email.split('@')[0],
        planId: freePlan.id,
      }).returning();
      
      profile = newProfile;

      // Add default categories
      const [healthCat] = await db.insert(categories).values({
        userId: profile.id,
        name: 'Health',
        color: '#ef4444', // Red
      }).returning();

      const [workCat] = await db.insert(categories).values({
        userId: profile.id,
        name: 'Work',
        color: '#3b82f6', // Blue
      }).returning();

      const [personalCat] = await db.insert(categories).values({
        userId: profile.id,
        name: 'Personal',
        color: '#10b981', // Emerald
      }).returning();

      // Add default goals
      await db.insert(goals).values([
        {
          userId: profile.id,
          name: 'Morning Workout',
          mission: 'Stay fit and energized',
          categoryId: healthCat.id,
          type: 'daily',
          target: 1,
          priority: 'high',
          reminderOn: true,
          reminderTime: '07:00',
        },
        {
          userId: profile.id,
          name: 'Drink 2L Water',
          mission: 'Stay hydrated',
          categoryId: healthCat.id,
          type: 'daily',
          target: 1,
          priority: 'medium',
          reminderOn: true,
          reminderTime: '10:00',
        },
        {
          userId: profile.id,
          name: 'Gym Session',
          mission: 'Build strength',
          categoryId: healthCat.id,
          type: 'weekly',
          target: 3,
          priority: 'high',
          reminderOn: false,
          reminderTime: '18:00',
        },
        {
          userId: profile.id,
          name: 'Read for 30 mins',
          mission: 'Expand knowledge',
          categoryId: personalCat.id,
          type: 'daily',
          target: 1,
          priority: 'medium',
          reminderOn: false,
          reminderTime: '21:00',
        },
        {
          userId: profile.id,
          name: 'Weekly Review',
          mission: 'Reflect and plan',
          categoryId: workCat.id,
          type: 'weekly',
          target: 1,
          priority: 'high',
          reminderOn: true,
          reminderTime: '17:00',
        },
        {
          userId: profile.id,
          name: 'Save Money',
          mission: 'Financial stability',
          categoryId: personalCat.id,
          type: 'monthly',
          target: 500,
          priority: 'medium',
          reminderOn: false,
          reminderTime: '09:00',
        }
      ]);
    }

    // Create custom session
    await createSession(profile.id);

    // Delete used OTP
    await db.delete(otps).where(eq(otps.email, email));

    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { error: 'Verification failed' };
  }

  redirect('/');
}

export async function logout() {
  const { deleteSession } = await import('@/utils/auth');
  await deleteSession();
  revalidatePath('/', 'layout');
  redirect('/login');
}
