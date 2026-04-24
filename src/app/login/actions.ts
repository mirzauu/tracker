'use server';

import { db } from '@/db';
import { otps, profiles, plans, categories, goals, userSessions, userActivity } from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { sendOtpEmail } from '@/utils/mail';
import { createSession } from '@/utils/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { parseUserAgent, getClientIp, getCountryFromHeaders } from '@/utils/deviceInfo';

export async function requestOtp(formData: FormData) {
  const email = formData.get('email') as string;
  if (!email) return { error: 'Email is required' };

  // Generate 6 digit OTP
  const code = Math.floor(1000 + Math.random() * 9000).toString();
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
    console.error('Error in requestOtp:', error);
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connection refused'))) {
      return { error: 'Database connection failed. Please check your DATABASE_URL.' };
    }
    return { error: 'Failed to send OTP. Please check your configuration (Database/Email).' };
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

    // ── Collect analytics data ─────────────────────────────────────────────
    const requestHeaders = await headers();
    const userAgent = requestHeaders.get('user-agent') || '';
    const { deviceType, os, browser } = parseUserAgent(userAgent);
    const ipAddress = getClientIp(requestHeaders);
    const country = getCountryFromHeaders(requestHeaders);
    const referrer = requestHeaders.get('referer') || null;

    // Timezone comes from the form (client-side Intl.DateTimeFormat)
    const timezone = (formData.get('timezone') as string) || 'UTC';

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Create JWT session
    await createSession(profile.id);

    // Save login session row
    await db.insert(userSessions).values({
      userId: profile.id,
      loggedInAt: now,
      ipAddress,
      userAgent,
      deviceType,
      os,
      browser,
      country,
      timezone,
      referrer,
    }).catch((e) => console.error('Failed to save user session:', e));

    // Update profile analytics
    await db.update(profiles).set({
      lastLoginAt: now,
      lastSeenAt: now,
      loginCount: sql`${profiles.loginCount} + 1`,
      timezone,
      ...(country ? { country } : {}),
    }).where(eq(profiles.id, profile.id))
      .catch((e) => console.error('Failed to update profile analytics:', e));

    // Upsert daily activity – count this login as a session on this day
    await db.insert(userActivity).values({
      userId: profile.id,
      activityDate: todayStr,
      firstActiveAt: now,
      lastActiveAt: now,
      pageViews: 0,
      goalsChecked: 0,
      sessionsOnDay: 1,
    }).onConflictDoUpdate({
      target: [userActivity.userId, userActivity.activityDate],
      set: {
        lastActiveAt: now,
        sessionsOnDay: sql`${userActivity.sessionsOnDay} + 1`,
      },
    }).catch((e) => console.error('Failed to upsert user activity:', e));

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
  // Track session end before destroying the session
  const { getSession, deleteSession } = await import('@/utils/auth');
  const session = await getSession();
  if (session?.userId) {
    const { trackEvent } = await import('@/utils/trackEvent');
    trackEvent(session.userId, 'session.ended');
  }
  await deleteSession();
  revalidatePath('/', 'layout');
  redirect('/login');
}
