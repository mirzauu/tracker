import { oauth2Client, saveTokens } from '@/utils/googleAuth';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const session = await getSession();
    const userId = session?.userId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to the database per user
    await saveTokens(userId, tokens);

    // Redirect back to the home page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error getting tokens:', error);
    return NextResponse.json({ error: 'Failed to exchange code for tokens' }, { status: 500 });
  }
}

