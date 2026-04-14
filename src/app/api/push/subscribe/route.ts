import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { getSession } from '@/utils/auth';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// Save a push subscription for the current user
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();
    
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Upsert: insert or update on conflict  
    await db.insert(pushSubscriptions).values({
      userId: session.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }).onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Delete a push subscription (unsubscribe)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    
    await db.delete(pushSubscriptions).where(
      and(
        eq(pushSubscriptions.userId, session.userId),
        eq(pushSubscriptions.endpoint, endpoint),
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete push subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
